import { getNflState } from '../app/libs/sleeper/api.server.js';
import {
  leagueWaiverChannelIds,
  postWaiverReports,
} from '../app/libs/waiver-report.server.js';
import { wednesdayMidnightPacific } from '../app/libs/waiver-sync.server.js';
import { getCurrentSeason } from '../app/models/season.server.js';
import { parentPort } from 'worker_threads';

async function postWaiverReportJob() {
  try {
    console.log('Starting waiver report job...');

    const channelIds = leagueWaiverChannelIds();
    if (!Object.values(channelIds).some(Boolean)) {
      const message =
        'No league waiver channels are set, skipping waiver report';
      console.log(message);
      if (parentPort) parentPort.postMessage({ success: true, message });
      return;
    }

    const season = await getCurrentSeason();
    if (!season) {
      const message = 'No current season found, skipping waiver report';
      console.log(message);
      if (parentPort) parentPort.postMessage({ success: true, message });
      return;
    }

    // Only used to decide which Sleeper weeks to look in. The week each report is
    // filed and titled under is read off the batch Sleeper actually ran, so a
    // state that has not rolled over yet cannot misfile anything.
    const nflState = await getNflState();

    const results = await postWaiverReports({
      year: season.year,
      batchAfter: wednesdayMidnightPacific(new Date()),
      nearWeek: nflState.week,
      channelIds,
    });

    for (const result of results) {
      console.log(
        `${result.leagueName} (week ${result.week ?? '?'}): ${result.status}` +
          (result.transactionCount
            ? ` (${result.transactionCount} rows)`
            : '') +
          (result.message ? ` - ${result.message}` : ''),
      );
    }

    const posted = results.filter(result => result.status === 'posted');
    const weeks = [...new Set(posted.map(result => result.week))].join(', ');
    const message = `Waiver report for ${season.year} week ${weeks || '-'}: ${
      posted.length
    } league(s) posted`;
    console.log(message);

    if (parentPort) {
      parentPort.postMessage({ success: true, message, results });
    }
  } catch (error) {
    console.error('Waiver report job failed:', error);
    if (parentPort) {
      parentPort.postMessage({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    process.exit(1);
  }
}

postWaiverReportJob();
