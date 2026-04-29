import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/layout/page-header";
import { LibraryContent } from "@/components/library/library-content";

export const metadata = { title: "Library — K2S Studio" };

export default function LibraryPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-screen-xl mx-auto px-6 py-8">
        <PageHeader title="Library" description="All generated slide decks" />
        <Separator className="my-6" />
        <LibraryContent />
      </div>
    </main>
  );
}
