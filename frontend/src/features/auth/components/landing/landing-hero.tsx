import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { buttonClasses } from "@/components/ui/button-styles";
import { ROUTES } from "@/constants/routes";
import { DogLanyard } from "./dog-lanyard";
import { LoveHeart } from "./love-heart";
import { OfferChip } from "./offer-chip";
import { Blob, PawMark } from "./landing-illustrations";
import { PawTrail } from "./paw-trail";

/*
 * The hero is one oversized lockup that scales as a unit: PAWF [dog] LIO, the dog's face standing in for the first O.
 * Every size and offset is a multiple of --hero-f, the wordmark's font size, so the dog, the sentences and the
 * lanyard stay in place from a 320 px phone to a wide desktop. --hero-f is capped by the width (the word is
 * 4.9 × --hero-f wide) and by the height (the lockup is about 3.05 × --hero-f tall), so it fills the first screen.
 * Only the word sizes the grid, so the word is what gets centred; the sentences are placed beside the dog.
 *
 * Zilla Slab Bold, measured in the browser (em): baseline 0.844 below the top of a 1-line box, cap height 0.656, the O
 * runs 0.172–0.86 and is 0.69 wide; PAWF is 2.62 and LIO 1.55 wide at -0.02em tracking.
 * The dog picture (971 × 1286, trimmed to the dog): its face, crown to chin, is about 325 px tall and centred at
 * (245, 168). At 2.2 × --hero-f wide the face is 0.74 em tall, the height of an O with its overshoot, so it is placed
 * with its centre on the O's centre (0.516 em down, in the middle of a 0.74 em gap). Its paws end 3.05 em below the
 * top of the letters.
 */
const DOG_PICTURE = "/images/illustrations/hero-dog-applicant.webp";

const HERO_FONT_SIZE = "clamp(2.75rem, min((100vw - 3.5rem) / 4.95, (100svh - 8rem) / 3.15), 16rem)";

const SENTENCE =
  "text-center font-display text-[length:clamp(1.0625rem,4.8vw,1.625rem)] leading-snug font-semibold text-balance text-primary " +
  "md:absolute md:row-start-2 md:top-[calc(var(--hero-f)*0.2)] " +
  "md:text-[length:max(1.125rem,calc(var(--hero-f)*0.13))] md:leading-[1.2]";

// AU-01 hero: the wordmark with the applicant dog, the LoFi's two sentences, the two sign-up paths and Sign in. The
// sentences tell the adoption story in motion: the offer chip is "sent", then the heart beats (landing-motion.ts).
export function LandingHero() {
  return (
    <section
      aria-labelledby="landing-title"
      style={{ "--hero-f": HERO_FONT_SIZE } as CSSProperties}
      className="relative isolate overflow-hidden bg-canvas px-gutter pt-14 pb-24 md:pt-16 md:pb-28"
    >
      <h1 id="landing-title" className="sr-only">
        Pawfolio
      </h1>

      <div
        className={
          "relative mx-auto grid w-fit grid-cols-[auto_calc(var(--hero-f)*0.74)_auto] " +
          "font-display text-[length:var(--hero-f)] leading-none font-bold text-ink"
        }
      >
        <DogBackdrop />
        {/* `relative` so the letters paint over the backdrop's circle; the dog (z-10) still sits in front of them. */}
        <span aria-hidden="true" className="relative col-start-1 row-start-1 justify-self-end tracking-[-0.02em]">
          PAWF
        </span>
        <span aria-hidden="true" className="relative col-start-3 row-start-1 tracking-[-0.02em]">
          LIO
        </span>

        <div className="relative z-10 col-start-2 row-start-1">
          <div className="absolute top-[calc(var(--hero-f)*0.135)] left-[calc(var(--hero-f)*-0.185)] aspect-971/1286 w-[calc(var(--hero-f)*2.2)]">
            <Image
              src={DOG_PICTURE}
              width={971}
              height={1286}
              alt="A smiling dog in a black suit and tie, wearing a Job applicant badge and a lanyard"
              preload
              sizes="(min-width: 768px) 570px, 160px"
              className="size-full max-w-none select-none"
              draggable={false}
            />
            <DogLanyard pictureSrc={DOG_PICTURE} />
          </div>
        </div>

        {/* Beside the dog, left: the offer chip. On tablets it is right-aligned against the dog; from lg up it starts
            at the cell's left edge, in line with the P, like the pitch below it. Absolutely placed in its cell so it
            doesn't widen the column (that would push the word off centre). On phones it follows the dog. */}
        <p className={`${SENTENCE} col-span-3 row-start-3 mt-8 md:col-span-1 md:col-start-1 md:right-[calc(var(--hero-f)*0.12)] md:mt-0 md:w-[calc(var(--hero-f)*2.45)] md:text-right lg:right-auto lg:left-0 lg:w-auto lg:text-left lg:whitespace-nowrap`}>
          <OfferChip name="Every pet deserves" argument="a job offer." />
        </p>
        <p className={`${SENTENCE} z-20 col-span-3 row-start-4 mt-3 md:col-span-1 md:col-start-3 md:left-[calc(var(--hero-f)*0.55)] md:mt-0 md:w-[calc(var(--hero-f)*1.15)] md:text-left`}>
          The job is being <LoveHeart>loved.</LoveHeart>
        </p>

        {/* Keeps the dog's height in the layout: its paws end 3.05 × --hero-f below the top of the letters. */}
        <div aria-hidden="true" className="col-start-2 row-start-2 h-[calc(var(--hero-f)*2.05)]" />
      </div>

      {/* The pitch and the sign-up paths. On phones and tablets they follow the lockup, centred. From lg up they sit
          in line with the P of PAWFOLIO and the offer chip (the word is 4.91 em wide, measured, and centred, so the P
          starts at 50% - 2.456 em),
          level with the space under the offer chip (top: the section's top padding, the letters'
          1 em line, the chip's offset and height). */}
      <div className="relative z-20 mx-auto mt-10 flex max-w-[46ch] flex-col items-center gap-5 text-center md:mt-12 lg:absolute lg:top-[calc(6.7rem+var(--hero-f)*1.44)] lg:left-[max(var(--pf-gutter-wide),calc(50%-var(--hero-f)*2.456))] lg:m-0 lg:max-w-[28rem] lg:items-start lg:text-left">
        <p className="text-lg text-ink-muted">
          Pets build a resume, apply to homes that fit their lifestyle, and get Hired by their future Furparent.
        </p>
        <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
          <Link href={ROUTES.signUpPet} className={buttonClasses({ variant: "primary" })}>
            I&apos;m a pet looking for a home
          </Link>
          <Link href={ROUTES.signUpHuman} className={buttonClasses({ variant: "secondary" })}>
            I want to adopt
          </Link>
        </div>
        <p className="text-sm text-ink-muted">
          Already on Pawfolio?{" "}
          <Link href={ROUTES.signIn} className="font-bold text-primary underline hover:text-primary-hover">
            Sign in
          </Link>
        </p>
      </div>

      <PawTrail className="absolute inset-x-0 bottom-6 md:bottom-8" />
    </section>
  );
}

/**
 * What frames the dog, scaled with the lockup and placed from the slot between F and L: one big soft-blue blob behind
 * its body that runs off the right and the bottom of the hero (the section clips it), and paw prints scattered around
 * it. It starts right of the left column's text, so the copy stays on the plain canvas; below lg it is smaller, so
 * its rounded bottom ends under the dog's paws, before the text that follows. Behind the dog (the letters
 * paint over it too); decorative only.
 */
function DogBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none relative col-start-2 row-start-1">
      <Blob className="absolute top-[calc(var(--hero-f)*0.42)] left-[calc(var(--hero-f)*-0.1)] w-[calc(var(--hero-f)*2.75)] fill-sky lg:w-[calc(var(--hero-f)*3.1)]" />
      <PawMark className="absolute top-[calc(var(--hero-f)*-0.2)] left-[calc(var(--hero-f)*-0.62)] w-[calc(var(--hero-f)*0.32)] -rotate-20 fill-blue-200" />
      <PawMark className="absolute top-[calc(var(--hero-f)*1.78)] left-[calc(var(--hero-f)*2.05)] w-[calc(var(--hero-f)*0.22)] rotate-15 fill-blue-700" />
      <PawMark className="absolute top-[calc(var(--hero-f)*2.78)] left-[calc(var(--hero-f)*2.3)] w-[calc(var(--hero-f)*0.15)] -rotate-10 fill-blue-300" />
      <PawMark className="absolute top-[calc(var(--hero-f)*2.78)] left-[calc(var(--hero-f)*0.02)] w-[calc(var(--hero-f)*0.16)] rotate-12 fill-blue-700" />
    </div>
  );
}
