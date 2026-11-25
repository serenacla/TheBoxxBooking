type Environment = Record<string, string | undefined>;
export function mailProvider(env: Environment = process.env) {
  return (env.MAIL_PROVIDER || "resend").trim().toLowerCase();
}
export function mailConfigurationIssues(env: Environment = process.env): string[] {
  const issues: string[] = [];
  if (!env.MAIL_FROM?.trim()) issues.push("MAIL_FROM fehlt.");
  const provider = mailProvider(env);
  if (provider === "smtp") {
    for (const name of ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"])
      if (!env[name]?.trim()) issues.push(`${name} fehlt.`);
    if (!/^[0-9]+$/.test(env.SMTP_PORT || "") || ![25, 465, 587].includes(Number(env.SMTP_PORT)))
      issues.push("SMTP_PORT muss 25, 465 oder 587 sein.");
  } else if (provider === "resend") {
    if (!env.RESEND_API_KEY?.trim()) issues.push("RESEND_API_KEY fehlt.");
  } else issues.push("MAIL_PROVIDER muss smtp oder resend sein.");
  return issues;
}
export function mailConfigured(env: Environment = process.env) {
  return mailConfigurationIssues(env).length === 0;
}
export function smtpOptions(env: Environment = process.env) {
  if (mailProvider(env) !== "smtp" || !mailConfigured(env))
    throw new Error("SMTP-Versand noch nicht vollständig eingerichtet.");
  const port = Number(env.SMTP_PORT);
  return {
    host: env.SMTP_HOST!.trim(), port, secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: env.SMTP_USER!.trim(), pass: env.SMTP_PASSWORD! },
    tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" as const },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    disableFileAccess: true, disableUrlAccess: true,
    logger: false as const, debug: false,
  };
}
