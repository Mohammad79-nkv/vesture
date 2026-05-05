"use client";

import { useState, useTransition, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Camera, Loader2 } from "lucide-react";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

const FIELD_INPUT_CLS =
  "h-11 w-full rounded-xl bg-paper px-3 text-[14px] text-ink shadow-[inset_0_0_0_1px_rgba(33,39,57,0.08)] outline-none transition-shadow focus:shadow-[inset_0_0_0_1.5px_rgba(205,2,104,0.6)]";

// Custom in-app edit form. Uses Clerk's client SDK directly so we don't have
// to proxy avatar bytes through our server — `setProfileImage({ file })`
// handles the upload + CDN, and `update({ firstName, lastName })` patches the
// rest. Email/password edits stay on Clerk's hosted account page.
export function EditProfileForm() {
  const t = useTranslations("meEdit");
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [pendingPhoto, setPendingPhoto] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);

  if (!isLoaded || !user) {
    return (
      <div className="flex items-center justify-center pt-20">
        <Loader2 size={20} className="animate-spin text-primary" aria-hidden="true" />
      </div>
    );
  }

  function handlePhotoPick(files: FileList | null) {
    setSubmitError(null);
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setSubmitError(t("errors.invalidImage"));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setSubmitError(t("errors.imageTooLarge"));
      return;
    }
    setPendingPhoto({ file, previewUrl: URL.createObjectURL(file) });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!user) return;

    startTransition(async () => {
      try {
        // Run profile-image upload + name update in parallel; if there's no
        // pending image, the array entry is a no-op resolved promise.
        await Promise.all([
          pendingPhoto ? user.setProfileImage({ file: pendingPhoto.file }) : null,
          user.update({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
          }),
        ]);
        setSavedFlash(true);
        // Server components cache Clerk's user, so a hard refresh on the way
        // back ensures the /me header picks up the new name + image.
        router.replace("/me");
        router.refresh();
      } catch {
        setSubmitError(t("errors.saveFailed"));
        setSavedFlash(false);
      }
    });
  }

  const previewUrl = pendingPhoto?.previewUrl ?? user.imageUrl;
  const initial =
    (firstName?.[0] ?? lastName?.[0] ?? user.username?.[0] ?? "U").toUpperCase();

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col px-5 pb-32 pt-2">
      <h1 className="text-[28px] font-bold tracking-[-0.02em] text-ink">
        {t("title")}
      </h1>
      <p className="mt-2 max-w-[380px] text-[13.5px] leading-[1.5] text-ink-soft">
        {t("subtitle")}
      </p>

      {/* Photo */}
      <div className="mt-6 flex items-center gap-4">
        <div className="relative">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt=""
              className="h-20 w-20 rounded-full object-cover shadow-[inset_0_0_0_1px_rgba(33,39,57,0.08)]"
            />
          ) : (
            <span
              aria-hidden="true"
              className="grid h-20 w-20 place-items-center rounded-full bg-primary text-[28px] font-bold text-paper"
            >
              {initial}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-full bg-paper px-4 py-2.5 text-[12px] font-semibold tracking-[-0.01em] text-ink shadow-[inset_0_0_0_1px_rgba(33,39,57,0.08)] hover:bg-mist"
        >
          <Camera size={14} aria-hidden="true" />
          {t("changePhoto")}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => handlePhotoPick(e.target.files)}
        />
      </div>

      {/* Names */}
      <div className="mt-6 flex flex-col gap-4">
        <Field label={t("firstName")}>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder={t("firstNamePlaceholder")}
            maxLength={40}
            autoComplete="given-name"
            className={FIELD_INPUT_CLS}
          />
        </Field>
        <Field label={t("lastName")}>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder={t("lastNamePlaceholder")}
            maxLength={40}
            autoComplete="family-name"
            className={FIELD_INPUT_CLS}
          />
        </Field>
      </div>

      {submitError && (
        <p className="mt-4 text-sm text-red-600">{submitError}</p>
      )}
      {savedFlash && !submitError && (
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.1em] text-secondary">
          {t("saved")}
        </p>
      )}

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={pending}
          className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl bg-ink/5 text-[12px] font-medium uppercase tracking-[0.06em] text-ink/85"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 flex-[2] items-center justify-center gap-2 rounded-2xl bg-ink text-[12px] font-medium uppercase tracking-[0.06em] text-paper disabled:opacity-60"
        >
          {pending ? (
            <>
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              {t("saving")}
            </>
          ) : (
            t("save")
          )}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink/55">
        {label}
      </span>
      {children}
    </label>
  );
}
