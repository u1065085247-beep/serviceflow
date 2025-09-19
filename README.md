ServiceFlow — FastAPI + Next.js (multiempresa)s

Descripción
ServiceFlow es un sistema de gestión de tickets con soporte multiempresa. Backend en FastAPI (Postgres + SQLAlchemy + JWT) y Frontend en Next.js (App Router, Tailwind, React Query). Incluye adjuntos (Local o S3/MinIO), dashboard, gestión de usuarios y empresas, y Docker Compose para desarrollo.

Estructura
- backend/: API FastAPI
- frontend/: Web App Next.js
- docker-compose.yml: Orquestación de Postgres, MinIO, Backend y Frontend

Requisitos
- Docker y Docker Compose
- (Opcional) Python 3.11+, Node 20 para ejecución sin Docker

Arranque rápido (Docker)
1) Clonar el repo:
   git clone https://github.com/josemd23z/serviceflow
   cd serviceflow

2) Levantar servicios:
   docker compose up --build

3) Acceso:
   - Frontend: http://localhost:3000
   - Backend: admin@acme.local
   - MinIO Console: http://localhost:9001 (usuario: minioadmin / pass: minioadmin)

Usuario demo
- Email: superadmin@serviceflow.local
- Password: admin123

Datos de prueba creados en el primer arranque
- Empresas: Acme Inc., Globex Corp.
- Usuarios:
  - superadmin@serviceflow.local / admin123 (superadmin)
  - admin@acme.local / admin123 (admin, puede ver todas las empresas)
  - admin@globex.local / admin123 (admin)
  - tech@acme.local / tech123 (técnico, sólo su empresa)
  - tech.global@acme.local / tech123 (técnico, puede ver todas)
  - user@acme.local / user123 (usuario)
  - user@globex.local / user123 (usuario)
- Tickets de ejemplo en ambas empresas.

Adjuntos
- Por defecto en Docker se usa MinIO (S3 compatible) con bucket serviceflow.
- Las URLs de descarga son presignadas y válidas temporalmente.

Modo local (sin Docker)

Backend
1) Configurar entorno:
   cd backend
   cp .env.example .env
   # Edita DATABASE_URL a tu Postgres local, y STORAGE_BACKEND=local o s3
2) Instalar:
   python -m venv .venv
   source .venv/bin/activate  # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
3) Ejecutar:
   uvicorn app.main:app --reload
   # API en http://localhost:8000

Frontend
1) Configurar:
   cd frontend
   echo "NEXT_PUBLIC_API_BASE=http://localhost:8000/api/v1" > .env.local
2) Instalar y arrancar:
   npm install
   npm run dev
   # Web en http://localhost:3000

Comandos Docker útiles
- Parar: docker compose down
- Parar y borrar volúmenes (datos): docker compose down -v
- Reconstruir tras cambios: docker compose up --build

Variables importantes (backend/.env.example)
- DATABASE_URL: postgresql+psycopg2://user:pass@host:port/db
- JWT_SECRET, JWT_EXPIRE_MIN
- STORAGE_BACKEND: local | s3
- UPLOAD_DIR: ruta local de uploads (si local)
- S3_BUCKET, S3_REGION, S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_USE_PATH_STYLE

Permisos por rol (resumen)
- superadmin: acceso total
- admin: por defecto su empresa; puede actuar en otra usando X-Company-Id
- tech: por defecto su empresa; puede usar X-Company-Id sólo si can_view_all_companies=true
- user: sólo su empresa y sus tickets

Selector de empresa en el Frontend
- En la barra superior hay un selector de empresa que guarda la selección en localStorage (sf_company_id).
- El cliente API añade X-Company-Id automáticamente si hay una empresa seleccionada.

Roadmap (pendiente)
- Alembic (migraciones) en lugar de create_all de desarrollo
- Comentarios en tickets + notificaciones por email
- Reportes/Exportaciones
- Gestión completa (modales) de usuarios/empresas desde UI

