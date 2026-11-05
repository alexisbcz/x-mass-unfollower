import type { CSSProperties, ReactNode } from "react";
import type { IconHome } from "twenty-ui/icon";

export type IconComp = typeof IconHome;

export const REPO = "https://github.com/alexisbcz/x-mass-unfollower";
export const ZIP = `${REPO}/archive/refs/heads/main.zip`;

/** A glossy app-icon tile, one hue per section. */
export function Gloss({ icon: Icon, hue, sat = 85, size = "sm" }: { icon: IconComp; hue: number; sat?: number; size?: "sm" | "md" }) {
  return (
    <span aria-hidden="true" className="tw-gloss" data-size={size === "sm" ? undefined : size} style={{ "--hue": hue, "--sat": sat } as CSSProperties}>
      <Icon aria-hidden />
    </span>
  );
}

export function PageHead({ icon, hue, title, actions }: { icon: IconComp; hue: number; title: ReactNode; actions?: ReactNode }) {
  return (
    <header className="tw-pagehead">
      <h1 className="tw-pagehead-title">
        <Gloss icon={icon} hue={hue} size="md" />
        {title}
      </h1>
      {actions && <div className="tw-pagehead-actions">{actions}</div>}
    </header>
  );
}

export function Panel({ children }: { children: ReactNode }) {
  return (
    <section className="tw-panel">
      <div className="tw-scroll">{children}</div>
    </section>
  );
}

export type Column<R> = { id: string; label: string; icon: IconComp; width: number; render: (r: R) => ReactNode; wrap?: boolean };

/** A read-only Twenty record table: icon headers, index column, fixed widths. */
export function RecordTable<R>({ rows, columns, rowKey, label }: { rows: R[]; columns: Column<R>[]; rowKey: (r: R) => string; label: string }) {
  return (
    <div className="tw-tablebox">
      <table className="tw-table" aria-label={label}>
        <colgroup>
          <col style={{ width: 36 }} />
          {columns.map((c) => (
            <col key={c.id} style={{ width: c.width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th aria-label="Row" />
            {columns.map((c) => (
              <th key={c.id}>
                <span className="tw-th">
                  <c.icon size={16} stroke={1.6} aria-hidden />
                  {c.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={rowKey(r)}>
              <td className="tw-index tw-num">{i + 1}</td>
              {columns.map((c) => (
                <td key={c.id} data-wrap={c.wrap || undefined}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
