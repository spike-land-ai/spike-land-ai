# spike-land-ai — Bulk operations across all repos
#
# Usage:
#   make build-all     Build in dependency order (via yarn workspaces)
#   make test-all      Run all tests
#   make lint-all      Run all linters
#   make check-all     lint + test everything
#   make validate      Check workspace graph vs dependency-map.json

SHELL := /bin/bash
ROOT := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

.PHONY: build-all test-all lint-all check-all status validate \
        build test test-watch test-coverage typecheck lint \
        rollback-worker rollback-spa rollback-spa-list \
        docker-setup docker-dev docker-ci docker-staging docker-prod \
        docker-down docker-ps docker-logs

build-all:
	yarn workspaces foreach -Apt run build
	@echo "All repos built successfully"

test-all:
	yarn workspaces foreach -Ap run test
	@echo "All tests passed"

lint-all:
	yarn workspaces foreach -Ap run lint
	@echo "All lint checks passed"

check-all: lint-all test-all
	@echo "All checks passed"

validate:
	node "$(ROOT).github/scripts/validate-workspace-graph.mjs"

# Short aliases
build: build-all
test: test-all
test-watch:
	yarn workspaces foreach -Ap run test:watch
test-coverage:
	yarn workspaces foreach -Ap run test:coverage
typecheck:
	yarn workspaces foreach -Apt run typecheck
lint: lint-all

rollback-worker:
	@test -n "$(WORKER)" || (echo "Usage: make rollback-worker WORKER=spike-edge" && exit 1)
	bash "$(ROOT)scripts/rollback.sh" worker "$(WORKER)"

rollback-spa-list:
	bash "$(ROOT)scripts/rollback.sh" spa list

rollback-spa:
	@test -n "$(SHA)" || (echo "Usage: make rollback-spa SHA=abc123" && exit 1)
	bash "$(ROOT)scripts/rollback.sh" spa "$(SHA)"

status:
	@for dir in $$(yarn workspaces list --json 2>/dev/null | node -e "\
		const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\n');\
		lines.forEach(l => { const w = JSON.parse(l); if (w.location !== '.') console.log(w.location); })"); do \
		if [ -d "$(ROOT)$$dir/.git" ]; then \
			branch=$$(cd "$(ROOT)$$dir" && git branch --show-current); \
			dirty=$$(cd "$(ROOT)$$dir" && git status --porcelain | head -1); \
			if [ -n "$$dirty" ]; then echo "$$dir ($$branch) — dirty"; \
			else echo "$$dir ($$branch) — clean"; fi; \
		fi; \
	done

# ─── Docker ──────────────────────────────────────────────────────────────────
COMPOSE_BASE := docker compose -f docker/docker-compose.yml

docker-setup:
	bash docker/scripts/setup-certs.sh
	bash docker/scripts/setup-dns.sh

docker-dev:
	$(COMPOSE_BASE) -f docker/docker-compose.dev.yml up -d

docker-ci:
	$(COMPOSE_BASE) -f docker/docker-compose.ci.yml up --abort-on-container-exit

docker-staging:
	$(COMPOSE_BASE) -f docker/docker-compose.staging.yml up -d

docker-prod:
	$(COMPOSE_BASE) -f docker/docker-compose.prod.yml up -d

docker-down:
	$(COMPOSE_BASE) down

docker-ps:
	$(COMPOSE_BASE) ps --format table

docker-logs:
	@test -n "$(SVC)" || (echo "Usage: make docker-logs SVC=spike-edge" && exit 1)
	$(COMPOSE_BASE) logs -f $(SVC)
