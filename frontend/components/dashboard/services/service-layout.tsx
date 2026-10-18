import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";

export function ServiceLayout({
  title,
  description,
  children,
  aside,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-5 sm:p-6">{children}</Card>
        {aside && <div className="space-y-6">{aside}</div>}
      </div>
    </div>
  );
}
