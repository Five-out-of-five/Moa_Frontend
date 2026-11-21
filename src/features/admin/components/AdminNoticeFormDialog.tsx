"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { createNoticeAction, updateNoticeAction } from "../actions";
import { NOTICE_TYPE_OPTIONS } from "../lib/notice-labels";
import type {
  AdminNoticeDetail,
  AdminNoticeRequest,
  AdminNoticeType,
} from "../types";

/**
 * 공지 생성/수정 공용 Dialog. prop `detail` 이 있으면 **수정**, 없으면 **생성**.
 *
 * 입력 필드는 datetime-local 로 받아 ISO 로 직렬화. `MAINTENANCE` 선택 시에만 점검 시작 필드 노출.
 * 서버가 사유·범위 유효성을 재검증하지만 UI 에서 제출 버튼 비활성·에러 토스트로 선제 차단.
 *
 * ⚠️ `datetime-local` 값은 **로컬 TZ 기반** 이라 서버가 `displayStartsAt` 등을 역으로 포맷할 때
 *    TZ 가 어긋날 수 있다. KST 운영 가정이라 UI 에선 로컬 → ISO 그대로 전송. 서버는 KST 에서
 *    렌더하므로 왕복 결과가 사용자가 선택한 값과 일치.
 */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 없으면 생성 모드, 있으면 수정 모드. */
  detail?: AdminNoticeDetail;
  /** 성공 시 상세 반영 콜백 — 상위 Sheet 가 들고 있음. 생성 모드는 생략. */
  onUpdated?: (next: AdminNoticeDetail) => void;
  /** 생성 성공 시 해당 ID 를 `?selected=` 로 열기 위해 상위에 전달. */
  onCreated?: (next: AdminNoticeDetail) => void;
}

const EMPTY: AdminNoticeRequest = {
  noticeType: "GENERAL",
  title: "",
  content: "",
  displayStartsAt: "",
  displayEndsAt: "",
};

/** ISO → datetime-local 인풋 값 ("yyyy-MM-ddTHH:mm") — Asia/Seoul 기준. */
function toLocalInput(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const kst = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  // sv-SE 포맷은 "yyyy-MM-dd HH:mm" — datetime-local 은 "T" 구분자.
  return kst.replace(" ", "T");
}

/** datetime-local 입력 ("yyyy-MM-ddTHH:mm") 을 KST 기준 ISO 로. */
function fromLocalInput(local: string): string {
  if (!local) return "";
  // KST offset 은 +09:00 고정이라 안전.
  return `${local}:00+09:00`;
}

export function AdminNoticeFormDialog({
  open,
  onOpenChange,
  detail,
  onUpdated,
  onCreated,
}: Props) {
  const isEdit = Boolean(detail?.noticeId);
  const [form, setForm] = useState<AdminNoticeRequest>(EMPTY);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    if (detail) {
      setForm({
        noticeType: (detail.noticeType as AdminNoticeType) ?? "GENERAL",
        title: detail.title ?? "",
        content: detail.content ?? "",
        displayStartsAt: toLocalInput(detail.displayStartsAt),
        displayEndsAt: toLocalInput(detail.displayEndsAt),
        maintenanceStartsAt: toLocalInput(detail.maintenanceStartsAt),
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, detail]);

  function set<K extends keyof AdminNoticeRequest>(
    key: K,
    value: AdminNoticeRequest[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    const payload: AdminNoticeRequest = {
      noticeType: form.noticeType,
      title: form.title.trim(),
      content: form.content.trim(),
      displayStartsAt: fromLocalInput(form.displayStartsAt),
      displayEndsAt: fromLocalInput(form.displayEndsAt),
      maintenanceStartsAt:
        form.noticeType === "MAINTENANCE" && form.maintenanceStartsAt
          ? fromLocalInput(form.maintenanceStartsAt)
          : undefined,
    };
    if (payload.title.length === 0) {
      toast.error("제목을 입력해 주세요.");
      return;
    }
    if (payload.content.length === 0) {
      toast.error("내용을 입력해 주세요.");
      return;
    }
    if (!payload.displayStartsAt || !payload.displayEndsAt) {
      toast.error("표시 기간을 선택해 주세요.");
      return;
    }
    if (payload.displayEndsAt <= payload.displayStartsAt) {
      toast.error("표시 종료일이 시작일보다 뒤여야 합니다.");
      return;
    }

    startTransition(async () => {
      const result = isEdit
        ? await updateNoticeAction(detail!.noticeId!, payload)
        : await createNoticeAction(payload);
      if (result.kind === "ok") {
        if (isEdit) onUpdated?.(result.detail);
        else onCreated?.(result.detail);
        toast.success(isEdit ? "공지를 수정했습니다." : "공지를 등록했습니다.");
        onOpenChange(false);
        return;
      }
      toast.error(result.message);
    });
  }

  const submitDisabled =
    pending ||
    form.title.trim().length === 0 ||
    form.content.trim().length === 0 ||
    !form.displayStartsAt ||
    !form.displayEndsAt;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "공지 수정" : "신규 공지"}</DialogTitle>
          <DialogDescription>
            표시 기간과 유형을 지정해 운영 공지를 등록합니다. 수정 시 작성 정보는
            유지됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <Label className="text-xs font-medium text-slate-600">유형</Label>
            <div
              className="mt-2 grid grid-cols-3 gap-2"
              role="group"
              aria-label="공지 유형 선택"
            >
              {NOTICE_TYPE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  disabled={pending}
                  onClick={() => set("noticeType", o.value)}
                  aria-pressed={form.noticeType === o.value}
                  className={
                    form.noticeType === o.value
                      ? "rounded-md bg-slate-900 px-2 py-2 text-xs font-semibold text-white"
                      : "rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700 hover:bg-slate-100"
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label
              htmlFor="notice-title"
              className="text-xs font-medium text-slate-600"
            >
              제목 <span className="text-amber-600">*</span>
            </Label>
            <input
              id="notice-title"
              type="text"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              maxLength={120}
              disabled={pending}
              placeholder="공지 제목"
              className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
          </div>

          <div>
            <Label
              htmlFor="notice-content"
              className="text-xs font-medium text-slate-600"
            >
              내용 <span className="text-amber-600">*</span>
            </Label>
            <Textarea
              id="notice-content"
              value={form.content}
              onChange={(e) => set("content", e.target.value)}
              rows={5}
              disabled={pending}
              placeholder="사용자에게 보여줄 공지 본문"
              className="mt-1.5"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label
                htmlFor="notice-start"
                className="text-xs font-medium text-slate-600"
              >
                표시 시작 (KST) <span className="text-amber-600">*</span>
              </Label>
              <input
                id="notice-start"
                type="datetime-local"
                value={form.displayStartsAt}
                onChange={(e) => set("displayStartsAt", e.target.value)}
                disabled={pending}
                className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
              />
            </div>
            <div>
              <Label
                htmlFor="notice-end"
                className="text-xs font-medium text-slate-600"
              >
                표시 종료 (KST) <span className="text-amber-600">*</span>
              </Label>
              <input
                id="notice-end"
                type="datetime-local"
                value={form.displayEndsAt}
                onChange={(e) => set("displayEndsAt", e.target.value)}
                disabled={pending}
                className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
              />
            </div>
          </div>

          {form.noticeType === "MAINTENANCE" && (
            <div>
              <Label
                htmlFor="notice-maintenance"
                className="text-xs font-medium text-slate-600"
              >
                점검 시작 (KST) <span className="text-slate-400">· 선택</span>
              </Label>
              <input
                id="notice-maintenance"
                type="datetime-local"
                value={form.maintenanceStartsAt ?? ""}
                onChange={(e) => set("maintenanceStartsAt", e.target.value)}
                disabled={pending}
                className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitDisabled}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "처리 중…" : isEdit ? "수정" : "등록"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
