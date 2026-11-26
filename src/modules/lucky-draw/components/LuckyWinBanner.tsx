import { Icon } from '@/components/icons';
import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { currentPlayer } from '@/modules/points/server';

/**
 * "You won!" on the winner's own phone. Only phones linked to a person (on
 * the My points page) can be told, and only about their own win: other
 * winners' names stay on the big screen, never on phones.
 */
export async function LuckyWinBanner() {
  const config = getEventConfig();
  if (!config.features.luckyDraw) return null;
  const player = await currentPlayer().catch(() => null);
  if (!player) return null;
  const wins = (await getData().luckyDraw.list()).filter((w) => w.attendeeId === player.id);
  if (wins.length === 0) return null;
  const prizes = wins.map((w) => w.prize.trim()).filter(Boolean);

  return (
    <aside
      role="status"
      aria-label="Lucky draw"
      className="mb-6 rounded-xl border-2 border-warning bg-warning/15 p-4 text-ink"
    >
      <p className="text-lg font-bold">
        <Icon name="sparkle" className="mr-1 inline size-5 align-text-bottom" />
        You won the lucky draw{prizes.length > 0 ? `: ${prizes.join(', ')}` : ''}!
      </p>
      <p className="mt-1">Collect your prize at the registration desk. Bring this phone.</p>
    </aside>
  );
}
