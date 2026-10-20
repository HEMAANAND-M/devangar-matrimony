import { AnnouncementBanner } from "./AnnouncementBanner";
import { Footer } from "./Footer";
import { Nav } from "./Nav";

/** Member-facing page frame: navigation, announcements, content column and footer. */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <AnnouncementBanner />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">{children}</main>
      <Footer />
    </>
  );
}
