import { REGISTRATION_TERMS_CONTENT, REGISTRATION_TERMS_TITLE, REGISTRATION_TERMS_VERSION } from "@/lib/policies";

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{REGISTRATION_TERMS_TITLE}</h1>
        <p className="text-sm text-muted-foreground mt-2">版本：{REGISTRATION_TERMS_VERSION}</p>
      </div>
      <div className="rounded-xl border bg-card p-6">
        <pre className="whitespace-pre-wrap text-sm leading-7 font-sans">{REGISTRATION_TERMS_CONTENT}</pre>
      </div>
    </div>
  );
}
