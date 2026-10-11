"use client";

import { type FormEvent, useState } from "react";
import { Field } from "@/components/forms/field";
import { RadioCards } from "@/components/forms/radio-cards";
import { Textarea } from "@/components/forms/textarea";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { Modal } from "@/components/overlays/modal";
import { Button } from "@/components/ui/button";
import { Meter } from "@/components/ui/meter";
import { Tag } from "@/components/ui/tag";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/providers/toast-provider";

// Dev-only demo for /ui-kit: the dialog shapes from the LoFi (FD-07, RP-01, AC admin actions, MT-03).
// Fake data, no network calls.

type Open = "report" | "delete" | "suspend" | "deactivate" | "breakdown" | null;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const REPORT_REASONS = [
  { value: "fake", label: "Fake or misleading profile", description: "Photos or details that aren't real." },
  { value: "selling", label: "Selling or trading animals", description: "Pawfolio is for adoption only." },
  { value: "harassment", label: "Harassment or hate", description: "Insults, threats or targeting someone." },
  { value: "welfare", label: "Animal welfare concern", description: "Signs of neglect or abuse." },
];

const BREAKDOWN: Array<[string, number, number]> = [
  ["Activity level and energy", 18, 20],
  ["Hours away and time alone", 13, 15],
  ["Home type and space needs", 15, 15],
  ["Pet experience", 12, 15],
  ["Preferred size and age", 13, 15],
  ["Kids and other pets", 9, 10],
  ["Special needs and care", 6, 10],
];

export function DialogDemo() {
  const toast = useToast();
  const [open, setOpen] = useState<Open>(null);
  const [failNext, setFailNext] = useState(true);
  const close = () => setOpen(null);

  function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    close();
    toast.show("Thanks for reporting. An admin will review it.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setOpen("report")} icon={<Icon name="flag" className="size-4" />}>
          Report post
        </Button>
        <Button onClick={() => setOpen("breakdown")}>Why this match?</Button>
        <Button onClick={() => setOpen("delete")}>Delete post</Button>
        <Button onClick={() => setOpen("suspend")}>Suspend account</Button>
        <Button onClick={() => setOpen("deactivate")}>Deactivate account</Button>
      </div>

      <Modal
        open={open === "report"}
        onClose={close}
        title="Report Mochi's post"
        subtitle="Reports are confidential. An admin reviews every report."
        closeOnBackdrop={false}
        onSubmit={submitReport}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Send report
            </Button>
          </>
        }
      >
        <RadioCards legend="Why are you reporting this?" name="reason" defaultValue="fake" options={REPORT_REASONS} />
        <Field label="Details" optional>
          <Textarea name="details" rows={3} maxLength={500} placeholder="Anything that helps the admin understand" />
        </Field>
      </Modal>

      <Modal
        open={open === "breakdown"}
        onClose={close}
        size="lg"
        title="86% match with Ana Santos"
        subtitle="Both sides see the same score. It updates when the quiz or resume changes."
        footer={
          <Button variant="primary" onClick={close}>
            Got it
          </Button>
        }
      >
        <div className="flex flex-col gap-2">
          <h3 className="text-lg">Dealbreakers: all passed</h3>
          <div className="flex flex-wrap gap-2">
            {["Species accepted", "OK with kids at home", "OK with pets at home", "Same province"].map((item) => (
              <Tag key={item} icon={<Icon name="check" className="size-4" />}>
                {item}
              </Tag>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="text-lg">Weighted score</h3>
          <dl className="flex flex-col gap-3">
            {BREAKDOWN.map(([criterion, points, weight]) => (
              <div key={criterion} className="grid gap-1 md:grid-cols-[14rem_minmax(0,1fr)] md:items-center md:gap-4">
                <dt className="text-sm">{criterion}</dt>
                <dd>
                  <Meter size="sm" format="fraction" value={points} max={weight} label={criterion} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Modal>

      <ConfirmDialog
        open={open === "delete"}
        onClose={close}
        destructive
        permanent
        title="Delete this post?"
        confirmLabel="Delete post"
        consequences={["The post and its photos are removed from the feed.", "Comments and reactions are removed too."]}
        onConfirm={() => toast.show("Post deleted.")}
      />

      <ConfirmDialog
        open={open === "suspend"}
        onClose={close}
        destructive
        title="Suspend Kulit's account?"
        subtitle="Admin action. It's written to the activity log with your reason."
        confirmLabel="Suspend account"
        consequences={[
          "Kulit is signed out on every device and the profile is hidden.",
          "Open requests are put on hold.",
          "You can reactivate the account later.",
        ]}
        reason={{
          label: "Reason for suspending",
          hint: "The account owner sees this reason.",
          placeholder: "e.g. Five confirmed reports of a fake profile",
        }}
        onConfirm={async () => {
          await wait(900);
          toast.show("Account suspended and logged.");
        }}
      />

      <ConfirmDialog
        open={open === "deactivate"}
        onClose={close}
        destructive
        title="Deactivate Kulit's account?"
        subtitle="Records are kept for adoption history and logs."
        confirmLabel="Deactivate account"
        reason={{ label: "Reason for deactivating", placeholder: "e.g. Duplicate account", minLength: 10 }}
        acknowledgement="I understand the owner won't be able to sign in."
        onConfirm={async () => {
          await wait(900);
          if (failNext) {
            setFailNext(false);
            throw new Error("Demo failure");
          }
          setFailNext(true);
          toast.show("Account deactivated and logged.");
        }}
      />

      <p className="max-w-[65ch] text-sm text-ink-muted">
        Deactivate needs a 10-character reason and the checkbox, and fails once on purpose to show the retry message.
      </p>
    </div>
  );
}
