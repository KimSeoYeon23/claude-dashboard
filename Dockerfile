# Stage 1: 프론트엔드 빌드
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY frontend/ .
RUN pnpm build

# Stage 2: 백엔드 실행
FROM python:3.12-slim
WORKDIR /app
COPY --from=frontend /app/static ./static
COPY backend/ ./backend/
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
ENV HOST=0.0.0.0
ENV DATA_DIR=/app/data
EXPOSE 8420
CMD ["python3", "backend/server.py"]
