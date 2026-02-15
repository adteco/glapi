#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
KARATE_VERSION="${KARATE_VERSION:-1.4.1}"
KARATE_DIR="${ROOT_DIR}/.tools/karate"
KARATE_JAR="${KARATE_DIR}/karate-${KARATE_VERSION}.jar"
KARATE_URL="https://github.com/karatelabs/karate/releases/download/v${KARATE_VERSION}/karate-${KARATE_VERSION}.jar"

if [[ ! -f "${KARATE_JAR}" ]]; then
  mkdir -p "${KARATE_DIR}"
  echo "Downloading Karate ${KARATE_VERSION}..."
  curl -fsSL "${KARATE_URL}" -o "${KARATE_JAR}"
fi

if [[ $# -gt 0 ]]; then
  ARGS=("$@")
else
  ARGS=("tests/karate/asc606-revenue.feature")
fi

cd "${ROOT_DIR}"
KARATE_CONFIG_DIR="${KARATE_CONFIG_DIR:-${ROOT_DIR}/tests/karate}"
java -Dkarate.config.dir="${KARATE_CONFIG_DIR}" -jar "${KARATE_JAR}" "${ARGS[@]}"
