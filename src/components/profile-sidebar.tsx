import Image from "next/image";
import { wallProfile } from "@/config/profile";

export function ProfileSidebar() {
  return (
    <aside className="profile-sidebar" aria-label="About Joel Rioflorido">
      <div className="profile-image-frame">
        <Image
          src={wallProfile.image}
          alt={wallProfile.imageDescription}
          width={1254}
          height={1254}
          sizes="(max-width: 700px) 64px, 240px"
          preload
          className="profile-image"
        />
      </div>
      <div className="profile-details">
        <h1 className="profile-name">{wallProfile.name}</h1>
        <dl className="profile-facts">
          <div>
            <dt>JOB</dt>
            <dd>{wallProfile.job}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{wallProfile.location}</dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}
