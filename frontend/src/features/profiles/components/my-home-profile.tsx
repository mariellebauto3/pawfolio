"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import { HomeProfileView } from "@/components/data-display/home-profile-view";
import { Banner } from "@/components/feedback/banner";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { ROUTES, homeProfileEditPath, petPath } from "@/constants/routes";
import { useSession } from "@/providers/session-provider";
import { useToast } from "@/providers/toast-provider";
import { EditIntroDialog } from "../dialogs/edit-intro-dialog";
import { firstOpenQuizStep, profileChecklist } from "../schemas/home-profile-schemas";
import type { OwnHomeProfile } from "../types/own-home-profile";
import { OpenToAdoptToggle } from "./open-to-adopt-toggle";

type Props = {
  home: OwnHomeProfile;
};

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// PR-11 My Home Profile, as the human sees it, with the Edit intro dialog (PR-12) and the Open to Adopt switch
// (PR-13). The Furparent label and the adopted pets come from the API once an adoption exists (FR13); nothing here
// sets them.
export function MyHomeProfile({ home: loaded }: Props) {
  const toast = useToast();
  const { refresh } = useSession();
  const [home, setHome] = useState(loaded);
  const [editingIntro, setEditingIntro] = useState(false);

  const quizPath = homeProfileEditPath(firstOpenQuizStep(home) + 1);
  const editIntro = () => setEditingIntro(true);

  // Where each item of the checklist is finished: two in the intro dialog, one in the quiz, one on its own page.
  const checklist: Record<ReturnType<typeof profileChecklist>[number]["key"], { label: string; action: ReactNode }> = {
    intro: {
      label: "About our home",
      action: (
        <Button variant="tertiary" size="sm" onClick={editIntro}>
          Add<span className="sr-only"> About our home</span>
        </Button>
      ),
    },
    quiz: {
      label: "Lifestyle quiz",
      action: (
        <Link href={quizPath} className={buttonClasses({ variant: "tertiary", size: "sm" })}>
          Finish<span className="sr-only"> the lifestyle quiz</span>
        </Link>
      ),
    },
    slots: {
      label: home.open_slots_count > 0 ? `Meet & Greet slots (${home.open_slots_count} open)` : "Meet & Greet slots",
      action: (
        <Link href={ROUTES.availability} className={buttonClasses({ variant: "tertiary", size: "sm" })}>
          Add<span className="sr-only"> Meet &amp; Greet slots</span>
        </Link>
      ),
    },
    photo: {
      label: "Profile photo",
      action: (
        <Button variant="tertiary" size="sm" onClick={editIntro}>
          Add<span className="sr-only"> a profile photo</span>
        </Button>
      ),
    },
  };

  return (
    <>
      <HomeProfileView
        home={home}
        owner
        notice={
          !home.has_completed_quiz && (
            <Banner
              tone="neutral"
              icon="pencil"
              title="Your Home Profile isn’t finished"
              actions={
                <Link href={quizPath} className={buttonClasses({ variant: "primary", size: "sm" })}>
                  Continue the quiz
                </Link>
              }
            >
              Pets for You and Open to Adopt unlock once all six steps are saved. It takes about 5 minutes.
            </Banner>
          )
        }
        actions={
          <>
            <Link href={ROUTES.homeProfileEdit} className={buttonClasses({ variant: home.has_completed_quiz ? "primary" : "secondary" })}>
              Edit Home Profile &amp; quiz
            </Link>
            <Button onClick={editIntro}>Edit intro</Button>
            <OpenToAdoptToggle home={home} onChange={setHome} />
            {home.has_completed_quiz && !home.is_open_to_adopt && (
              <p className="basis-full text-sm text-ink-muted">
                Open to Adopt is off: pets can’t send you new requests. Requests already in progress continue.
              </p>
            )}
          </>
        }
        adoptedPetAction={(adoption) => (
          // The adoption's timeline and facts (AL-06) open from the alumni profile.
          <Link href={petPath(adoption.pet.id)} className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Adoption details<span className="sr-only"> for {adoption.pet.name}</span>
          </Link>
        )}
        aside={
          <>
            <Card title="Profile checklist" as="section">
              <ul className="flex flex-col divide-y divide-line">
                {profileChecklist(home).map(({ key, done }) => (
                  <li key={key} className="flex min-h-11 items-center gap-3 py-1 first:pt-0 last:pb-0">
                    {done ? (
                      <Icon name="circle-check" className="size-5 shrink-0 text-primary" />
                    ) : (
                      <span aria-hidden="true" className="size-5 shrink-0 rounded-pill border-[1.5px] border-line-strong" />
                    )}
                    <span className={done ? "flex-1" : "flex-1 text-ink-muted"}>
                      {checklist[key].label}
                      <span className="sr-only">{done ? ": done" : ": not done yet"}</span>
                    </span>
                    {!done && checklist[key].action}
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Profile views" as="section">
              <p className="text-sm">
                {home.views_count > 0
                  ? `Your Home Profile has had ${count(home.views_count, "view", "views")}.`
                  : home.is_open_to_adopt
                    ? "No one has opened your Home Profile yet."
                    : "No one has opened your Home Profile yet. Turning on Open to Adopt puts it in pets’ Homes for You."}
              </p>
            </Card>
          </>
        }
      />

      <EditIntroDialog
        open={editingIntro}
        onClose={() => setEditingIntro(false)}
        home={home}
        onSaved={(next, changed) => {
          setHome(next);
          toast.show("Intro saved.");
          // The top bar shows the profile photo too; it reads it from the session.
          if (changed.profilePhoto) void refresh();
        }}
      />
    </>
  );
}
