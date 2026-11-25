import type { ReactNode } from "react";

import styles from "./error-state.module.css";

export function ErrorState({
  code,
  title,
  description,
  onRetry,
  returnHref = "/workspaces",
  returnLabel = "워크스페이스 목록으로",
  digest,
  fullPage = false,
  children,
}: {
  code: "404" | "500";
  title: string;
  description: ReactNode;
  onRetry?: () => void;
  returnHref?: string;
  returnLabel?: string;
  digest?: string;
  fullPage?: boolean;
  children?: ReactNode;
}) {
  const reference = digest && /^\d{1,20}(?:@E\d{1,6})?$/.test(digest) ? digest : null;
  return (
    <section
      className={`${styles.state} ${fullPage ? styles.fullPage : ""}`}
      data-page-error={code === "500" ? true : undefined}
      aria-label={`${code} 오류 안내`}
    >
      <div className={styles.content}>
        <p className={styles.brand}>MOA</p>
        <p className={styles.code} aria-hidden="true">
          {code}
        </p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
        <div className={styles.actions}>
          {onRetry && (
            <button type="button" className={styles.retry} onClick={onRetry}>
              다시 시도
            </button>
          )}
          <a className={styles.link} href={returnHref}>
            {returnLabel}
          </a>
          {children}
        </div>
        {reference && <p className={styles.reference}>오류 확인 번호: {reference}</p>}
      </div>
    </section>
  );
}
