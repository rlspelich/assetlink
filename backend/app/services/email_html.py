"""
HTML generators for email content — work orders and inspections.

These produce email-safe HTML (inline styles, simple layout) that mirrors
the print layout but adds an email wrapper and footer.
"""

from datetime import date, datetime


def _fmt_date(val: date | datetime | None) -> str:
    if val is None:
        return "\u2014"
    if isinstance(val, datetime):
        return val.strftime("%b %d, %Y")
    return val.strftime("%b %d, %Y")


def _fmt_enum(val: str | None) -> str:
    if not val:
        return "\u2014"
    return val.replace("_", " ").title()


def _esc(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


# --- Work Order ---


def generate_work_order_email_html(
    wo,
    assets: list,
    labels: dict | None = None,
    custom_message: str | None = None,
) -> tuple[str, str]:
    """
    Generate email subject and HTML body for a work order.

    Args:
        wo: WorkOrder model instance.
        assets: List of WorkOrderAsset model instances.
        labels: Dict mapping asset_id -> display label string.
        custom_message: Optional custom message from the sender.

    Returns:
        (subject, html_body)
    """
    if labels is None:
        labels = {}
    wo_number = wo.work_order_number or "Work Order"
    desc_short = (wo.description or "")[:80]
    subject = f"{wo_number}"
    if desc_short:
        subject += f" \u2014 {desc_short}"

    # Build assets section
    assets_html = ""
    if assets:
        asset_rows = []
        for a in assets:
            label = labels.get(a.asset_id) or _fmt_enum(a.asset_type)
            action = _fmt_enum(getattr(a, "action_required", None))
            notes = getattr(a, "damage_notes", None) or "\u2014"
            asset_rows.append(
                f'<tr>'
                f'<td style="padding: 4px 8px; border-bottom: 1px solid #eee;">'
                f'\u25A1 {_esc(label)}</td>'
                f'<td style="padding: 4px 8px; border-bottom: 1px solid #eee;">'
                f'{_esc(action)}</td>'
                f'<td style="padding: 4px 8px; border-bottom: 1px solid #eee;">'
                f'{_esc(notes)}</td>'
                f'</tr>'
            )
        assets_html = f"""
        <div style="margin-top: 16px;">
          <strong>AFFECTED ASSETS</strong>
          <table style="width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 13px;">
            <tr style="background: #f5f5f5;">
              <th style="text-align: left; padding: 4px 8px;">Asset</th>
              <th style="text-align: left; padding: 4px 8px;">Action</th>
              <th style="text-align: left; padding: 4px 8px;">Notes</th>
            </tr>
            {"".join(asset_rows)}
          </table>
        </div>
        """

    message_block = ""
    if custom_message:
        message_block = f"""
        <div style="background: #f0f4ff; border-left: 3px solid #3b82f6;
                    padding: 12px 16px; margin-bottom: 16px; font-size: 14px; color: #1e3a5f;">
          {_esc(custom_message)}
        </div>
        """

    html = f"""<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; font-size: 14px; color: #222; max-width: 650px; margin: 0 auto; padding: 24px;">
  {message_block}
  <div style="border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 16px;">
    <div style="font-size: 22px; font-weight: bold; letter-spacing: 1px;">WORK ORDER</div>
    <div style="font-size: 18px; font-weight: bold; color: #333;">{_esc(wo_number)}</div>
  </div>

  <table style="width: 100%; font-size: 14px; margin-bottom: 12px;">
    <tr>
      <td><strong>Priority:</strong> {_esc(_fmt_enum(wo.priority))}</td>
      <td><strong>Status:</strong> {_esc(_fmt_enum(wo.status))}</td>
    </tr>
    <tr>
      <td><strong>Work Type:</strong> {_esc(_fmt_enum(wo.work_type))}</td>
      <td><strong>Created:</strong> {_esc(_fmt_date(wo.created_at))}</td>
    </tr>
    <tr>
      <td><strong>Due Date:</strong> {_esc(_fmt_date(wo.due_date))}</td>
      <td><strong>Assigned To:</strong> {_esc(str(wo.assigned_to) if wo.assigned_to else "\u2014")}</td>
    </tr>
  </table>

  {"<div style='margin-top: 12px;'><strong>DESCRIPTION</strong><div style='margin-top: 4px; white-space: pre-wrap;'>" + _esc(wo.description) + "</div></div>" if wo.description else ""}

  {"<div style='margin-top: 12px;'><strong>LOCATION</strong><div style='margin-top: 4px;'>" + _esc(wo.address or "") + "</div></div>" if wo.address else ""}

  {assets_html}

  {"<div style='margin-top: 12px;'><strong>INSTRUCTIONS</strong><div style='margin-top: 4px; white-space: pre-wrap;'>" + _esc(wo.instructions) + "</div></div>" if wo.instructions else ""}

  {"<div style='margin-top: 12px;'><strong>NOTES</strong><div style='margin-top: 4px; white-space: pre-wrap;'>" + _esc(wo.notes) + "</div></div>" if wo.notes else ""}

  <div style="margin-top: 32px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 11px; color: #888;">
    Sent from AssetLink &mdash; Municipal Asset Management
  </div>
</body>
</html>"""

    return subject, html


# --- Inspection ---


def generate_inspection_email_html(
    insp,
    assets: list,
    labels: dict | None = None,
    custom_message: str | None = None,
) -> tuple[str, str]:
    """
    Generate email subject and HTML body for an inspection.

    Returns:
        (subject, html_body)
    """
    if labels is None:
        labels = {}
    insp_number = insp.inspection_number or "Inspection"
    findings_short = (insp.findings or "")[:80]
    subject = f"{insp_number}"
    if findings_short:
        subject += f" \u2014 {findings_short}"

    # Build assets section
    assets_html = ""
    if assets:
        asset_rows = []
        for ia in assets:
            label = labels.get(ia.asset_id) or _fmt_enum(ia.asset_type)
            cond = f"{ia.condition_rating}/5" if ia.condition_rating else "\u2014"
            action = _fmt_enum(getattr(ia, "action_recommended", None))
            findings = getattr(ia, "findings", None) or "\u2014"

            retro_info = ""
            if ia.retroreflectivity_value is not None:
                passes = (
                    "Yes" if ia.passes_minimum_retro is True
                    else "No" if ia.passes_minimum_retro is False
                    else "\u2014"
                )
                retro_info = f"<br>Retro: {ia.retroreflectivity_value} mcd/lux/m\u00B2 (Passes: {passes})"

            asset_rows.append(
                f'<tr>'
                f'<td style="padding: 4px 8px; border-bottom: 1px solid #eee; vertical-align: top;">'
                f'{_esc(label)}</td>'
                f'<td style="padding: 4px 8px; border-bottom: 1px solid #eee;">{cond}</td>'
                f'<td style="padding: 4px 8px; border-bottom: 1px solid #eee;">'
                f'{_esc(action)}</td>'
                f'<td style="padding: 4px 8px; border-bottom: 1px solid #eee;">'
                f'{_esc(findings)}{retro_info}</td>'
                f'</tr>'
            )

        assets_html = f"""
        <div style="margin-top: 16px;">
          <strong>INSPECTED ASSETS</strong>
          <table style="width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 13px;">
            <tr style="background: #f5f5f5;">
              <th style="text-align: left; padding: 4px 8px;">Asset</th>
              <th style="text-align: left; padding: 4px 8px;">Condition</th>
              <th style="text-align: left; padding: 4px 8px;">Action</th>
              <th style="text-align: left; padding: 4px 8px;">Findings</th>
            </tr>
            {"".join(asset_rows)}
          </table>
        </div>
        """

    message_block = ""
    if custom_message:
        message_block = f"""
        <div style="background: #f0f4ff; border-left: 3px solid #3b82f6;
                    padding: 12px 16px; margin-bottom: 16px; font-size: 14px; color: #1e3a5f;">
          {_esc(custom_message)}
        </div>
        """

    condition_str = f"{insp.condition_rating}/5" if insp.condition_rating else "\u2014"
    follow_up = "Yes" if insp.follow_up_required else "No"

    html = f"""<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; font-size: 14px; color: #222; max-width: 650px; margin: 0 auto; padding: 24px;">
  {message_block}
  <div style="border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 16px;">
    <div style="font-size: 22px; font-weight: bold; letter-spacing: 1px;">INSPECTION</div>
    <div style="font-size: 18px; font-weight: bold; color: #333;">{_esc(insp_number)}</div>
  </div>

  <table style="width: 100%; font-size: 14px; margin-bottom: 12px;">
    <tr>
      <td><strong>Type:</strong> {_esc(_fmt_enum(insp.inspection_type))}</td>
      <td><strong>Status:</strong> {_esc(_fmt_enum(insp.status))}</td>
    </tr>
    <tr>
      <td><strong>Date:</strong> {_esc(_fmt_date(insp.inspection_date))}</td>
      <td><strong>Overall Condition:</strong> {_esc(condition_str)}</td>
    </tr>
    <tr>
      <td><strong>Follow-up Required:</strong> {follow_up}</td>
      <td></td>
    </tr>
  </table>

  {assets_html}

  {"<div style='margin-top: 12px;'><strong>OVERALL FINDINGS</strong><div style='margin-top: 4px; white-space: pre-wrap;'>" + _esc(insp.findings) + "</div></div>" if insp.findings else ""}

  {"<div style='margin-top: 12px;'><strong>RECOMMENDATIONS</strong><div style='margin-top: 4px; white-space: pre-wrap;'>" + _esc(insp.recommendations) + "</div></div>" if insp.recommendations else ""}

  <div style="margin-top: 32px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 11px; color: #888;">
    Sent from AssetLink &mdash; Municipal Asset Management
  </div>
</body>
</html>"""

    return subject, html
