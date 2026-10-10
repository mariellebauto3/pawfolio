import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { buttonClasses } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { ContactDetailsForm } from "../forms/contact-details-form";
import type { Settings } from "../types/accounts";
import { CloseAccountCard } from "./close-account-card";
import { NotificationSettings } from "./notification-settings";
import { PasswordCardActions } from "./password-card-actions";
import { VerifiedDetails } from "./verified-details";

type Props = {
  settings: Settings;
};

// Settings (AC-01 pet, AC-02 human): one page for both roles, with the cards in the LoFi's order. What differs by
// role is which details are verified and whose contact details are kept. Each card saves by itself: a change request
// and a new password go through their dialogs, a switch applies at once, and the contact form has its own Save.
export function SettingsScreen({ settings }: Props) {
  const { account } = settings;

  return (
    <div className="mx-auto flex w-full max-w-narrow flex-col">
      <PageHeader title="Settings" description="Manage your account, contact details and notifications." />

      <div className="flex flex-col gap-6">
        <VerifiedDetails role={account.role} details={settings.locked_details} requests={settings.change_requests} />

        <Card
          title={account.role === "pet" ? "Caretaker contact" : "Contact details"}
          description={
            account.role === "pet"
              ? "Who a home reaches about this pet. After an adoption the pet keeps its account: update this to the Furparent’s details once the login is handed over."
              : "Private. Shared only with the other side once a Meet & Greet is confirmed."
          }
        >
          <ContactDetailsForm role={account.role} details={settings.contact_details} />
        </Card>

        <Card title="Notifications" description="Choose what shows up in your Alerts. A change applies right away.">
          <NotificationSettings preferences={settings.notification_preferences} />
        </Card>

        <Card title="Sign-in & security">
          <div className="flex flex-col gap-4">
            <dl className="text-sm">
              <dt className="text-ink-muted">Email</dt>
              {/* The address the account signs in with. Nothing here changes it. */}
              <dd className="text-base wrap-break-word">{account.email}</dd>
            </dl>
            <div className="flex flex-wrap gap-3">
              <PasswordCardActions />
              <Link href={ROUTES.activity} className={buttonClasses({ variant: "tertiary", size: "sm" })}>
                See sign-in activity
              </Link>
            </div>
          </div>
        </Card>

        <CloseAccountCard role={account.role} name={account.display_name} />
      </div>
    </div>
  );
}
