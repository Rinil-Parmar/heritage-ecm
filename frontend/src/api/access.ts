export interface DocumentAccess {
  schema_version: number
  edit_details: boolean
  edit_metadata: boolean
  upload_version: boolean
  add_comment: boolean
  download: boolean
  tags_add: number[]
  tags_remove: number[]
  cabinets_add: number[]
  cabinets_remove: number[]
}
