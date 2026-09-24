# ==============================================================================
# Wrench — Deployment & Operations Automation Makefile
# AWS EC2 Instance i-09cb4321863636d82 (Elastic IP: 13.202.225.48)
# ==============================================================================

SHELL := /bin/bash
COMPOSE := docker compose

.PHONY: help deploy build up down stop restart ps logs logs-backend logs-frontend logs-db check seed create-admin db-shell prune

help:
	@echo "Wrench Operations Commands:"
	@echo "  make deploy         - Pull latest git changes, build images, and restart stack"
	@echo "  make build          - Build Docker container images"
	@echo "  make up             - Start containers in detached mode"
	@echo "  make down           - Stop and remove containers"
	@echo "  make stop           - Stop running containers"
	@echo "  make restart        - Restart all containers without rebuilding"
	@echo "  make ps             - View status of running containers"
	@echo "  make logs           - Follow logs from all containers"
	@echo "  make logs-backend   - Follow backend logs"
	@echo "  make logs-frontend  - Follow frontend logs"
	@echo "  make logs-db        - Follow database logs"
	@echo "  make check          - Run comprehensive health check on live endpoints"
	@echo "  make seed           - Re-run demo and admin database seeder"
	@echo "  make create-admin   - Provision a super-admin interactively"
	@echo "  make db-shell       - Open interactive psql shell on Wrench PostgreSQL"
	@echo "  make prune          - Free host disk space by removing unused Docker cache"

deploy:
	git pull
	$(COMPOSE) up -d --build --remove-orphans
	@echo "Deployment complete! Run 'make check' to verify status."

build:
	$(COMPOSE) build

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

stop:
	$(COMPOSE) stop

restart:
	$(COMPOSE) restart

ps:
	$(COMPOSE) ps

logs:
	$(COMPOSE) logs -f

logs-backend:
	$(COMPOSE) logs -f backend

logs-frontend:
	$(COMPOSE) logs -f frontend

logs-db:
	$(COMPOSE) logs -f db

check:
	@echo "=== [1/3] Checking Docker Container Status ==="
	@$(COMPOSE) ps
	@echo ""
	@echo "=== [2/3] Checking Backend Health Endpoint ==="
	@curl -sf http://127.0.0.1:$$(grep -E '^BACKEND_PORT=' .env 2>/dev/null | cut -d '=' -f2 || echo 8005)/api/v1/health && echo " -> Backend is HEALTHY" || echo " -> Backend health check FAILED"
	@echo ""
	@echo "=== [3/3] Checking Frontend Web Access ==="
	@curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:$$(grep -E '^PORT=' .env 2>/dev/null | cut -d '=' -f2 || echo 8085)/ | grep -q "200" && echo " -> Frontend is SERVING HTTP 200" || echo " -> Frontend response check FAILED"

seed:
	$(COMPOSE) exec backend python -m scripts.seed_initial

create-admin:
	@read -p "Admin Email: " email; \
	read -p "Admin Phone (e.g. +919876543200): " phone; \
	$(COMPOSE) exec -it backend python -m scripts.create_admin --email "$$email" --phone "$$phone"

db-shell:
	$(COMPOSE) exec -it db psql -U postgres -d wrench

prune:
	docker system prune -af --volumes
