import { WallApp } from "@/components/wall-app";
import { ProfileSidebar } from "@/components/profile-sidebar";
import Image from "next/image";

export default function Home() {
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        Skip to the wall
      </a>
      <header className="site-header">
        <div className="header-inner">
          <span className="wordmark">
            <Image
              src="/my-wall-logo.png"
              alt=""
              width={40}
              height={40}
              className="wordmark-logo"
            />
            wall<span>.</span>
          </span>
        </div>
      </header>
      <div className="page-layout">
        <ProfileSidebar />
        <WallApp />
      </div>
    </div>
  );
}
