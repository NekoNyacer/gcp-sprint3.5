#!/usr/bin/env bash

set -euo pipefail

readonly EXPECTED_PROJECT_ID="cathay-ai-hackathon-team-03"
readonly SEED_FILE="${1:-tasks.json}"

if [[ ! -f "${SEED_FILE}" ]]; then
  echo "找不到 seed 檔案：${SEED_FILE}" >&2
  exit 1
fi

for command_name in gcloud curl jq date base64; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "缺少必要指令：${command_name}" >&2
    exit 1
  fi
done

active_project="$(gcloud config get-value project 2>/dev/null)"
if [[ "${active_project}" != "${EXPECTED_PROJECT_ID}" ]]; then
  echo "目前專案是 ${active_project}，預期為 ${EXPECTED_PROJECT_ID}，停止寫入。" >&2
  exit 1
fi

timezone="$(jq -r '.timezone' "${SEED_FILE}")"
export TZ="${timezone}"

today="$(date +%F)"
today_id="$(date +%Y%m%d)"
day_of_week="$(date +%u)"
week_start="$(date -d "${today} -$((day_of_week - 1)) days" +%F)"
week_start_id="$(date -d "${week_start}" +%Y%m%d)"
week_end="$(date -d "${week_start} +7 days" +%F)"
access_token="$(gcloud auth print-access-token)"
response_file="$(mktemp)"

cleanup() {
  unset access_token
  rm -f -- "${response_file}"
}
trap cleanup EXIT

create_task() {
  local task_json="$1"
  local cadence task_id_prefix task_id starts_at ends_at duration_days payload status

  cadence="$(jq -r '.cadence' <<<"${task_json}")"
  task_id_prefix="$(jq -r '.taskIdPrefix' <<<"${task_json}")"

  case "${cadence}" in
    daily)
      task_id="${task_id_prefix}-${today_id}"
      starts_at="${today}T00:00:00+08:00"
      ends_at="$(date -d "${today} +1 day" +%F)T00:00:00+08:00"
      ;;
    weekly)
      task_id="${task_id_prefix}-${week_start_id}"
      starts_at="${week_start}T00:00:00+08:00"
      ends_at="${week_end}T00:00:00+08:00"
      ;;
    event)
      duration_days="$(jq -r '.durationDays' <<<"${task_json}")"
      task_id="${task_id_prefix}-${today_id}"
      starts_at="${today}T00:00:00+08:00"
      ends_at="$(date -d "${today} +${duration_days} days" +%F)T00:00:00+08:00"
      ;;
    *)
      echo "不支援的 cadence：${cadence}" >&2
      return 1
      ;;
  esac

  payload="$(jq --arg starts_at "${starts_at}" --arg ends_at "${ends_at}" '{
    fields: {
      areaId: {stringValue: .areaId},
      cadence: {stringValue: .cadence},
      title: {stringValue: .title},
      description: {stringValue: .description},
      startsAt: {timestampValue: $starts_at},
      endsAt: {timestampValue: $ends_at},
      destination: {mapValue: {fields: {
        id: {stringValue: .destination.id},
        name: {stringValue: .destination.name},
        address: {stringValue: .destination.address},
        latitude: {doubleValue: .destination.latitude},
        longitude: {doubleValue: .destination.longitude}
      }}},
      reward: {mapValue: {fields: {
        type: {stringValue: .reward.type},
        amount: {integerValue: (.reward.amount | tostring)}
      }}}
    }
  }' <<<"${task_json}")"

  status="$(curl --silent --show-error \
    --output "${response_file}" \
    --write-out '%{http_code}' \
    --request POST \
    --header "Authorization: Bearer ${access_token}" \
    --header 'Content-Type: application/json; charset=utf-8' \
    --data-binary "${payload}" \
    "https://firestore.googleapis.com/v1/projects/${EXPECTED_PROJECT_ID}/databases/(default)/documents/tasks?documentId=${task_id}")"

  case "${status}" in
    200)
      echo "已建立 ${task_id}"
      ;;
    409)
      echo "已存在，略過 ${task_id}"
      ;;
    *)
      echo "建立 ${task_id} 失敗（HTTP ${status}）：" >&2
      cat "${response_file}" >&2
      return 1
      ;;
  esac
}

while IFS= read -r encoded_task; do
  create_task "$(printf '%s' "${encoded_task}" | base64 --decode)"
done < <(jq -r '.tasks[] | @base64' "${SEED_FILE}")
