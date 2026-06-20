import json
from pathlib import Path

from fastmcp import FastMCP

mcp = FastMCP('pipeline-status')

SHARED_DIR = Path(__file__).parent.parent / 'shared' / 'results'


def _read_results() -> list[dict]:
    if not SHARED_DIR.exists():
        return []
    results = []
    for f in sorted(SHARED_DIR.glob('*.json')):
        try:
            results.append(json.loads(f.read_text(encoding='utf-8')))
        except (json.JSONDecodeError, OSError):
            continue
    return results


@mcp.tool()
def get_transaction_status(transaction_id: str) -> dict:
    """Return the current status of a transaction by ID from shared/results/."""
    for message in _read_results():
        data = message.get('data', {})
        if data.get('transaction_id') == transaction_id:
            return {
                'transaction_id': transaction_id,
                'status': data.get('status', 'unknown'),
                'risk_level': data.get('risk_level'),
                'risk_score': data.get('risk_score'),
                'compliance_flags': data.get('compliance_flags', []),
                'rejection_reason': data.get('rejection_reason'),
                'processed_by': message.get('source_agent'),
                'processed_at': message.get('timestamp'),
            }
    return {'transaction_id': transaction_id, 'status': 'not_found'}


@mcp.tool()
def list_pipeline_results() -> dict:
    """Return a summary of all processed transactions from shared/results/."""
    messages = _read_results()
    summary = {'total': 0, 'compliant': 0, 'flagged': 0, 'rejected': 0, 'transactions': []}

    for message in messages:
        data = message.get('data', {})
        status = data.get('status', 'unknown')
        summary['total'] += 1

        if status == 'compliant':
            summary['compliant'] += 1
        elif status == 'flagged':
            summary['flagged'] += 1
        elif status == 'rejected':
            summary['rejected'] += 1

        summary['transactions'].append({
            'transaction_id': data.get('transaction_id'),
            'amount': data.get('amount'),
            'currency': data.get('currency'),
            'status': status,
            'risk_level': data.get('risk_level'),
        })

    return summary


@mcp.resource('pipeline://summary')
def pipeline_summary() -> str:
    """Latest pipeline run summary as human-readable text."""
    messages = _read_results()

    if not messages:
        return 'No pipeline results found. Run: node integrator.js'

    counts = {'compliant': 0, 'flagged': 0, 'rejected': 0}
    lines = ['Pipeline Results Summary', '=' * 40]

    for message in messages:
        data = message.get('data', {})
        status = data.get('status', 'unknown')
        counts[status] = counts.get(status, 0) + 1

        flags = data.get('compliance_flags') or []
        reason = data.get('rejection_reason') or (', '.join(flags) if flags else 'none')
        lines.append(
            f"{data.get('transaction_id')}  {data.get('amount')} {data.get('currency')}"
            f"  {status}  {reason}"
        )

    lines.append('=' * 40)
    lines.append(f"Total: {len(messages)}  Compliant: {counts['compliant']}"
                 f"  Flagged: {counts['flagged']}  Rejected: {counts['rejected']}")

    return '\n'.join(lines)


if __name__ == '__main__':
    mcp.run()
