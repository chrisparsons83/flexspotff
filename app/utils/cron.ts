/**
 * Converts a cron expression to a human-readable string
 * @param cronExpression - Standard cron expression (minute hour day month dayOfWeek)
 * @returns Human-readable description of the cron schedule
 */
export function cronToHuman(cronExpression: string | undefined): string {
  if (!cronExpression || typeof cronExpression !== 'string') {
    return 'No schedule';
  }

  const parts = cronExpression.trim().split(/\s+/);

  // Standard cron format: minute hour day month dayOfWeek
  if (parts.length !== 5) {
    return cronExpression; // Return original if not standard format
  }

  const [minute, hour, day, month, dayOfWeek] = parts;

  // Helper functions
  const getMinuteText = (min: string): string => {
    if (min === '0') return '';
    if (min === '*') return 'every minute';
    if (min.includes('/')) {
      const interval = min.split('/')[1];
      return `every ${interval} minutes`;
    }
    if (min.includes(',')) {
      return `at minutes ${min.replace(/,/g, ', ')}`;
    }
    return `at minute ${min}`;
  };

  const getHourText = (hr: string): string => {
    if (hr === '*') return 'every hour';
    if (hr.includes('/')) {
      const interval = hr.split('/')[1];
      return `every ${interval} hours`;
    }
    if (hr.includes(',')) {
      const hours = hr.split(',').map(h => {
        const hourNum = parseInt(h);
        if (hourNum === 0) return '12:00 AM';
        if (hourNum < 12) return `${hourNum}:00 AM`;
        if (hourNum === 12) return '12:00 PM';
        return `${hourNum - 12}:00 PM`;
      });
      return `at ${hours.join(', ')}`;
    }
    const hourNum = parseInt(hr);
    if (isNaN(hourNum)) return `at hour ${hr}`;

    if (hourNum === 0) return '12:00 AM';
    if (hourNum < 12) return `${hourNum}:00 AM`;
    if (hourNum === 12) return '12:00 PM';
    return `${hourNum - 12}:00 PM`;
  };

  const getDayText = (d: string): string => {
    if (d === '*') return '';
    if (d.includes('/')) {
      const interval = d.split('/')[1];
      return `every ${interval} days`;
    }
    if (d.includes(',')) {
      return `on days ${d.replace(/,/g, ', ')} of the month`;
    }
    return `on day ${d} of the month`;
  };

  const getMonthText = (m: string): string => {
    if (m === '*') return '';

    const monthNames = [
      '',
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    if (m.includes(',')) {
      const months = m.split(',').map(month => {
        const monthNum = parseInt(month);
        return monthNames[monthNum] || month;
      });
      return `in ${months.join(', ')}`;
    }

    const monthNum = parseInt(m);
    if (!isNaN(monthNum) && monthNames[monthNum]) {
      return `in ${monthNames[monthNum]}`;
    }

    return m !== '*' ? `in month ${m}` : '';
  };

  const getDayOfWeekText = (dow: string): string => {
    if (dow === '*') return '';

    const dayNames = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];

    if (dow.includes(',')) {
      const days = dow.split(',').map(day => {
        const dayNum = parseInt(day);
        return dayNames[dayNum] || day;
      });
      return `on ${days.join(', ')}`;
    }

    const dayNum = parseInt(dow);
    if (!isNaN(dayNum) && dayNames[dayNum]) {
      return `on ${dayNames[dayNum]}`;
    }

    return dow !== '*' ? `on day ${dow}` : '';
  };

  // Handle common patterns first
  if (cronExpression === '0 0 * * *') return 'Daily at 12:00 AM';
  if (cronExpression === '0 12 * * *') return 'Daily at 12:00 PM';
  if (cronExpression === '0 0 * * 0') return 'Weekly on Sunday at 12:00 AM';
  if (cronExpression === '0 0 1 * *') return 'Monthly on the 1st at 12:00 AM';
  if (cronExpression === '0 0 1 1 *')
    return 'Yearly on January 1st at 12:00 AM';

  // Build description from parts
  let description = '';

  // Start with frequency
  if (dayOfWeek !== '*') {
    description = 'Weekly ';
  } else if (day !== '*') {
    description = 'Monthly ';
  } else if (month !== '*') {
    description = 'Yearly ';
  } else if (hour !== '*') {
    description = 'Daily ';
  } else {
    description = 'Hourly ';
  }

  // Add day of week
  if (dayOfWeek !== '*') {
    description += getDayOfWeekText(dayOfWeek) + ' ';
  }

  // Add day of month
  if (day !== '*' && dayOfWeek === '*') {
    description += getDayText(day) + ' ';
  }

  // Add month
  if (month !== '*') {
    description += getMonthText(month) + ' ';
  }

  // Add time
  if (hour !== '*') {
    const hourText = getHourText(hour);
    const minuteText = getMinuteText(minute);

    if (minute === '0') {
      description += `at ${hourText}`;
    } else {
      // For non-zero minutes, construct full time
      const hourNum = parseInt(hour);
      const minNum = parseInt(minute);

      if (!isNaN(hourNum) && !isNaN(minNum)) {
        const timeStr = formatTime(hourNum, minNum);
        description += `at ${timeStr}`;
      } else {
        description += `at ${hourText}`;
        if (minuteText) description += ` ${minuteText}`;
      }
    }
  } else if (minute !== '*') {
    description += getMinuteText(minute);
  }

  return description.trim();
}

/**
 * Formats hour and minute into a readable time string
 */
function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const displayMinute = minute.toString().padStart(2, '0');

  return `${displayHour}:${displayMinute} ${period}`;
}

/**
 * Common cron expressions and their human-readable equivalents
 */
export const COMMON_CRON_PATTERNS = {
  '0 0 * * *': 'Daily at 12:00 AM',
  '0 12 * * *': 'Daily at 12:00 PM',
  '0 0 * * 0': 'Weekly on Sunday at 12:00 AM',
  '0 0 * * 1': 'Weekly on Monday at 12:00 AM',
  '0 0 1 * *': 'Monthly on the 1st at 12:00 AM',
  '0 0 1 1 *': 'Yearly on January 1st at 12:00 AM',
  '*/5 * * * *': 'Every 5 minutes',
  '0 */2 * * *': 'Every 2 hours',
  '0 9 * * 1-5': 'Weekdays at 9:00 AM',
  '0 2 * * 2': 'Weekly on Tuesday at 2:00 AM',
  '0 5 * * 2': 'Weekly on Tuesday at 5:00 AM',
  '0 7 * * 2': 'Weekly on Tuesday at 7:00 AM',
} as const;
