"use client";

import { useActionState } from "react";
import { Field, TextareaField } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import type { FormState } from "@/lib/forms/state";
import { updateProfile } from "./actions";
import { AvatarPicker } from "./avatar-picker";

export function ProfileForm({
  userId,
  initial,
  avatarUrl,
}: {
  userId: string;
  initial: { displayName: string; handle: string; bio: string };
  avatarUrl: string | null;
}) {
  const [state, action] = useActionState<FormState, FormData>(updateProfile, {});
  const e = state.fieldErrors ?? {};
  const v = state.values ?? initial;

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage message={state.message} status={state.status} />
      <AvatarPicker userId={userId} name={v.displayName ?? initial.displayName} currentUrl={avatarUrl} />
      <Field
        name="displayName"
        label="Name"
        hint="Shown on everything you post. Your real name is encouraged."
        autoComplete="name"
        maxLength={60}
        required
        defaultValue={v.displayName}
        errors={e.displayName}
      />
      <Field
        name="handle"
        label="Handle"
        hint="Your profile address. Changing it changes your profile link."
        autoCapitalize="none"
        spellCheck={false}
        maxLength={31}
        required
        defaultValue={v.handle}
        errors={e.handle}
      />
      <TextareaField
        name="bio"
        label="Bio"
        hint="Optional, up to 500 characters. Plain text."
        maxLength={500}
        defaultValue={v.bio}
        errors={e.bio}
      />
      <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
    </form>
  );
}
