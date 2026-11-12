ARG MAYAN_BASE=mayanedms/mayanedms:s4.12
FROM ${MAYAN_BASE}
USER root
COPY . /opt/archeoecm-access-build
RUN /opt/mayan-edms/bin/python -m pip install --no-cache-dir --no-deps /opt/archeoecm-access-build
# Preserve the upstream entrypoint. Activate the app through Compose environment.
