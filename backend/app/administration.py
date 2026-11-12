"""Narrow account provisioning; upstream permissions remain authoritative."""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, SecretStr
from app.auth import trusted_origin
from app.uploads import all_rows, call, require_write
from app.documents import check_upstream

router = APIRouter(prefix='/api/v1/admin', tags=['Administration'])
RESEARCH_GROUPS = {'System Administrators', 'Department Administrators', 'Research Professors', 'Research Assistants', 'Research Viewers'}

async def administrator(request: Request):
    response = await call(request, 'GET', '/users/current/')
    check_upstream(request, response.status_code)
    user_id = response.json()['id']
    groups = await all_rows(request, f'/users/{user_id}/groups/')
    if not any(group['name'] == 'System Administrators' for group in groups):
        raise HTTPException(403, 'Account administration is restricted to System Administrators.')
    return user_id

@router.get('/access')
async def access(request: Request):
    try:
        await administrator(request)
        return {'allowed': True}
    except HTTPException as exc:
        if exc.status_code == 403:
            return {'allowed': False}
        raise

@router.get('/users', dependencies=[Depends(administrator)])
async def users(request: Request):
    rows = await all_rows(request, '/users/')
    return {'results': [{key: row.get(key) for key in ('id', 'username', 'first_name', 'last_name', 'is_active')} for row in rows]}

@router.get('/groups', dependencies=[Depends(administrator)])
async def groups(request: Request):
    rows = await all_rows(request, '/groups/')
    return {'results': [{'id': row['id'], 'name': row['name']} for row in rows if row['name'] in RESEARCH_GROUPS]}

class NewUser(BaseModel):
    username: str = Field(min_length=1, max_length=150, pattern=r'^[\w.@+-]+$')
    password: SecretStr = Field(min_length=12, max_length=128)
    group_id: int = Field(gt=0)

@router.post('/users', dependencies=[Depends(trusted_origin), Depends(require_write), Depends(administrator)])
async def create_user(request: Request, body: NewUser):
    available = await groups(request)
    if body.group_id not in {row['id'] for row in available['results']}:
        raise HTTPException(422, 'Select a configured access group.')
    response = await call(request, 'POST', '/users/', json={'username': body.username, 'password': body.password.get_secret_value()})
    if response.status_code == 400:
        raise HTTPException(422, 'Username is unavailable or password does not meet the platform requirements.')
    if response.status_code != 201:
        check_upstream(request, response.status_code)
        raise HTTPException(502, 'Account creation was not confirmed. Check the user list before retrying.')
    user_id = response.json()['id']
    # Creation and membership are separate operations. Never retry account creation automatically.
    try:
        assigned = await call(request, 'POST', f'/groups/{body.group_id}/users/add/', json={'user': user_id})
        success = assigned.status_code in (200, 201, 204)
    except HTTPException:
        success = False
    return {'created': True, 'user_id': user_id, 'group_assigned': success}

@router.get('/users/{user_id}', dependencies=[Depends(administrator)])
async def user_detail(request: Request, user_id: int):
    response = await call(request, 'GET', f'/users/{user_id}/')
    check_upstream(request, response.status_code)
    row = response.json()
    memberships = await all_rows(request, f'/users/{user_id}/groups/')
    return {**{key: row.get(key, '') for key in ('id', 'username', 'first_name', 'last_name', 'email')},
            'groups': [{'id': group['id'], 'name': group['name']} for group in memberships]}

class UserUpdate(BaseModel):
    first_name: str = Field(max_length=150)
    last_name: str = Field(max_length=150)
    email: str = Field(max_length=254)
    group_ids: list[int] = Field(max_length=5)
    original_group_ids: list[int] = Field(max_length=100)

@router.put('/users/{user_id}', dependencies=[Depends(trusted_origin), Depends(require_write)])
async def update_user(request: Request, user_id: int, body: UserUpdate):
    actor_id = await administrator(request)
    current = await user_detail(request, user_id)
    existing = {row['id'] for row in current['groups']}
    if existing != set(body.original_group_ids):
        raise HTTPException(409, 'Membership changed. Reopen the account before saving.')
    available = (await groups(request))['results']
    allowed = {row['id'] for row in available}
    desired = set(body.group_ids)
    if desired - allowed:
        raise HTTPException(422, 'Select only configured access groups.')
    if actor_id == user_id and (existing & allowed) != desired:
        raise HTTPException(403, 'Ask another system administrator to change your own access groups.')
    response = await call(request, 'PATCH', f'/users/{user_id}/', json=body.model_dump(include={'first_name', 'last_name', 'email'}))
    if response.status_code == 400:
        raise HTTPException(422, 'Check the name and email address.')
    check_upstream(request, response.status_code)
    errors = []
    # Preserve memberships outside the five project groups. Add before removing.
    for action, ids in [('add', desired - existing), ('remove', (existing & allowed) - desired)]:
        if errors:
            break
        for group_id in sorted(ids):
            try:
                result = await call(request, 'POST', f'/groups/{group_id}/users/{action}/', json={'user': user_id})
                if result.status_code not in (200, 201, 204):
                    errors.append('Some group changes were rejected. Reload and review the account.')
                    break
            except HTTPException:
                errors.append('Some changes could not be confirmed. Reload before retrying.')
                break
    final = await user_detail(request, user_id)
    if {row['id'] for row in final['groups']} & allowed != desired and not errors:
        errors.append('Group membership does not match the requested selection. Reload and review.')
    return {'saved': not errors, 'errors': errors, 'user': final}
