import type { Metadata } from 'next';

import { requireAdmin } from '@/lib/admin-guard';
import { DeviceCheck } from '@/modules/device-check/components/DeviceCheck';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Device check' };

export default async function DeviceCheckPage() {
  await requireAdmin('/admin/device-check');
  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-ink">Device check</h1>
        <p className="mt-2 text-lg text-ink-soft">
          Open this page on each real device you will use: the check in tablet, the projector
          laptop, and the secretariat phones. It tests the camera, alerts, speed, clock and screen
          in this browser and says what to fix. It cannot print or show the projector, so do those
          in the Test plan.
        </p>
      </header>
      <DeviceCheck />
      <section aria-labelledby="projector" className="space-y-2">
        <h2 id="projector" className="text-lg font-bold text-ink">
          Projector test pattern
        </h2>
        <p className="text-ink-soft">
          On the projector laptop, check the edges are not cut off and the text can be read from the
          back. The four corner marks should all be visible.
        </p>
        <div
          aria-hidden
          className="relative aspect-video w-full overflow-hidden rounded-xl border border-line bg-black"
        >
          {['left-0 top-0', 'right-0 top-0', 'bottom-0 left-0', 'bottom-0 right-0'].map((pos) => (
            <span key={pos} className={`absolute size-8 bg-white ${pos}`} />
          ))}
          <div className="absolute inset-0 flex items-center justify-center text-center text-white">
            <p className="text-2xl font-bold">Can you read this from the back of the room?</p>
          </div>
        </div>
      </section>
    </div>
  );
}
