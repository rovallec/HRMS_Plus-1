import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgCharts } from 'ag-charts-angular';
import { AppeasementService } from '../services/appeasement.service';

import {
  ModuleRegistry,
  AllCommunityModule
} from 'ag-charts-community';

ModuleRegistry.registerModules([
  AllCommunityModule
]);

@Component({
  selector: 'app-bimi',
  standalone: true,
  imports: [
    CommonModule,
    AgCharts
  ],
  templateUrl: './bimi.html',
  styleUrls: ['./bimi.css']
})
export class Bimi implements OnInit {

  constructor(private api: AppeasementService) { }

  // =========================================================
  // STATE
  // =========================================================

  currentLobPage = 0;
  clients: any[] = [];

  timezone: 'UTC' | 'ET' = 'UTC';

  loading:boolean = false;

  showTicketModal = false;

  loadingTickets = false;

  liveTickets: any[] = [];

  ticketModalTitle = '';
  // =========================================================
  // INIT
  // =========================================================

  ngOnInit(): void {
    this.loadMetrics();
  }

  // =========================================================
  // TIMEZONE
  // =========================================================

toggleTimezone() {

  this.loading = true;

  setTimeout(() => {

    this.timezone =
      this.timezone === 'UTC'
        ? 'ET'
        : 'UTC';

    // reload everything
    this.loadMetrics();

  }, 50);

}

  private convertTime(date: Date): Date {
    if (this.timezone === 'ET') {
      return new Date(date.getTime() - 5 * 60 * 60 * 1000);
    }
    return date;
  }

  // =========================================================
  // HELPERS
  // =========================================================

  private isBacklogMetric(metricName: string): boolean {
    const name = (metricName || '').toLowerCase();
    return name.includes('backlog');
  }

  // =========================================================
  // LOAD
  // =========================================================

  loadMetrics() {

  this.loading = true;

  this.api.getBimiMetrics().subscribe({

    next: (data: any[]) => {

      const groupedLobs: any = {};

      // =====================================================
      // GROUP DATA
      // =====================================================

      data.forEach((row: any) => {

        const lobCode = row.lob_code || 'unknown';

        if (!groupedLobs[lobCode]) {
          groupedLobs[lobCode] = {
            name: row.lob_name,
            code: row.lob_code,
            metrics: [],
            metricPage: 0
          };
        }

        const lob = groupedLobs[lobCode];

        const metricKey =
          `${row.metric_id}_${row.channel_id}`;

        let metric =
          lob.metrics.find((m: any) => m.metricKey === metricKey);

        if (!metric) {

          metric = {
            metricKey,
            selectedDay: null,
            weekPage: 0,

            metricId: row.metric_id,
            channelId: row.channel_id,
            name: `${row.metric_name} (${row.channel_name})`,

            dailyData: {},
            dailyCards: [],

            summaryMetrics: {
              totalVolume: 0,
              avgPerInterval: 0,
              maxVolume: 0,
              activeIntervals: 0
            },

            chartOptions: null,
            latestValue: 0
          };

          lob.metrics.push(metric);
        }

        const value = Number(row.metric_value);

        const snapshot = this.convertTime(
          new Date(row.snapshot_at_utc)
        );

        const dayKey =
          `${snapshot.getFullYear()}-${
            String(snapshot.getMonth() + 1).padStart(2, '0')
          }-${
            String(snapshot.getDate()).padStart(2, '0')
          }`;

        if (!metric.dailyData[dayKey]) {
          metric.dailyData[dayKey] = [];
        }

        metric.dailyData[dayKey].push({
          time: snapshot.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          }),
          value,
          timestamp: snapshot.getTime()
        });

      });

      // =====================================================
      // FINALIZE
      // =====================================================

      const clients: any[] = [];

      for (const key in groupedLobs) {

        const lob = groupedLobs[key];

        lob.metrics.forEach((metric: any) => {

          metric.dailyCards =
            Object.keys(metric.dailyData)
              .map(day => {

                const isBacklog =
                  this.isBacklogMetric(metric.name);

                const dayData =
                  metric.dailyData[day];

                const sortedDayData =
                  [...dayData].sort(
                    (a, b) =>
                      (a.timestamp || 0) -
                      (b.timestamp || 0)
                  );

                const values =
                  sortedDayData.map(
                    (d: any) => d.value
                  );

                const total = isBacklog
                  ? (sortedDayData.at(-1)?.value || 0)
                  : values.reduce(
                      (a: number, b: number) => a + b,
                      0
                    );

                return {
                  day,
                  volume: Math.round(total),
                  data: sortedDayData
                };

              })
              .sort((a: any, b: any) =>
                b.day.localeCompare(a.day)
              );

          const firstDay =
            metric.selectedDay ||
            metric.dailyCards.at(0);

          if (firstDay) {

            metric.selectedDay = firstDay;

            this.applyChart(metric, firstDay.data);
          }

        });

        clients.push(lob);
      }

      this.clients = clients;

      // IMPORTANT
      this.loading = false;

    },

    error: (err: any) => {

      console.error(err);

      this.loading = false;
    }

  });

}

  // =========================================================
  // DAY CLICK
  // =========================================================

  selectDay(metric: any, day: any) {
    metric.selectedDay = day;
    this.applyChart(metric, day.data);
  }

  // =========================================================
  // CORE LOGIC
  // =========================================================

  private applyChart(metric: any, data: any[]) {

    const isBacklog =
      this.isBacklogMetric(metric.name);

    const sorted =
      [...data].sort(
        (a, b) =>
          (a.timestamp || 0) -
          (b.timestamp || 0)
      );

    const values =
      sorted.map(d => d.value);

    const total = isBacklog
      ? (sorted.at(-1)?.value || 0)
      : values.reduce((a, b) => a + b, 0);

    const max =
      Math.max(...values, 0);

    const active =
      values.filter(v => v > 0).length;

    const lastValue = isBacklog
      ? (sorted.at(-1)?.value || 0)
      : sorted.at(-1)?.value || 0;

    metric.latestValue = lastValue;

    metric.summaryMetrics = {
      totalVolume: Math.round(total),

      avgPerInterval: values.length
        ? (total / values.length).toFixed(2)
        : '0.00',

      maxVolume: max,

      activeIntervals: active
    };

    metric.chartOptions =
      this.buildChart(sorted);
  }

  // =========================================================
  // REBUILD (TIMEZONE)
  // =========================================================

  rebuildCharts() {

    this.clients.forEach(lob => {

      lob.metrics.forEach((metric: any) => {

        const selected =
          metric.selectedDay ||
          metric.dailyCards?.at(0);

        if (selected) {
          this.applyChart(metric, selected.data);
        }

      });

    });

  }

  // =========================================================
  // PAGINATION
  // =========================================================

  getCurrentClient() {
    return this.clients[this.currentLobPage];
  }

  totalLobPages() {
    return Math.max(1, this.clients.length);
  }

  nextLobPage() {
    if (
      this.currentLobPage <
      this.totalLobPages() - 1
    ) {
      this.currentLobPage++;
    }
  }

  previousLobPage() {
    if (this.currentLobPage > 0) {
      this.currentLobPage--;
    }
  }

  nextMetric(client: any) {
    if (
      client.metricPage <
      client.metrics.length - 1
    ) {
      client.metricPage++;
    }
  }

  previousMetric(client: any) {
    if (client.metricPage > 0) {
      client.metricPage--;
    }
  }

  getCurrentMetric(client: any) {
    return client.metrics[client.metricPage];
  }


  // =========================================================
// WEEK PAGINATION
// =========================================================

getVisibleDays(metric: any) {

  const start =
    metric.weekPage * 7;

  const end =
    start + 7;

  return metric.dailyCards.slice(start, end);
}

nextWeek(metric: any) {

  const totalPages =
    Math.ceil(metric.dailyCards.length / 7);

  if (metric.weekPage < totalPages - 1) {
    metric.weekPage++;
  }
}

previousWeek(metric: any) {

  if (metric.weekPage > 0) {
    metric.weekPage--;
  }
}

// =========================================================
// LIVE ZENDESK TICKETS
// =========================================================

openTicketModal(client: any, metric: any) {

  this.showTicketModal = true;

  this.loadingTickets = true;

  this.liveTickets = [];

  try {

    // =====================================================
    // GET LAST INTERVAL
    // =====================================================

    const sorted =
      [...metric.selectedDay.data]
        .sort((a, b) =>
          (b.timestamp || 0) -
          (a.timestamp || 0)
        );

    const latest =
      sorted[0];

    if (!latest) {

      this.loadingTickets = false;

      return;
    }

    // =====================================================
    // WINDOW
    // =====================================================

const intervalEnd =
  new Date(latest.timestamp);

// =====================================================
// START OF DAY
// =====================================================

const intervalStart =
  new Date(intervalEnd);

intervalStart.setHours(0);
intervalStart.setMinutes(0);
intervalStart.setSeconds(0);
intervalStart.setMilliseconds(0);

    // =====================================================
    // TITLE
    // =====================================================

    this.ticketModalTitle =
      `${client.name} - ${metric.name}`;

    // =====================================================
    // LOB QUERY
    // =====================================================

    let lobQuery = '';

    const lobMap: any = {

      haggar:
        'custom_field_48599291116059:01KP7FPAFKCBCYM07598S1TP0J',

      colehaan:
        'custom_field_48599291116059:01KP7FPAGD7P2MTYPKX9PYFVQN',
            kimco:
        'custom_field_48599291116059:01KP7FPAGD7P2MTYPKX9PYFVQN',
              marcjacobs:
        'custom_field_48599291116059:01KP7FPAGD7P2MTYPKX9PYFVQN',

    };

    lobQuery =
      lobMap[
        client.code?.toLowerCase()
      ] || '';

    // =====================================================
    // CHANNEL
    // =====================================================

    let channel = '';

    const metricName =
      metric.name.toLowerCase();

    if (metricName.includes('(email)')) {
      channel = 'mail';
    }

    if (metricName.includes('(phone)')) {
      channel = 'phone';
    }

    if (metricName.includes('(chat)')) {
      channel = 'chat';
    }

    // =====================================================
    // METRIC TYPE
    // =====================================================

    let metricType = '';

    if (metricName.includes('opened')) {
      metricType = 'opened';
    }

    if (metricName.includes('solved')) {
      metricType = 'solved';
    }

    if (metricName.includes('backlog')) {
      metricType = 'backlog';
    }

    // =====================================================
    // PAYLOAD
    // =====================================================

    const payload = {

      lobField:lobQuery,

      channel,

      metricType,

      intervalStartUtc:
        intervalStart.toISOString(),

      intervalEndUtc:
        intervalEnd.toISOString()

    };

    // =====================================================
    // API CALL
    // =====================================================

this.api
  .getLiveZendeskTickets(payload)
  .subscribe({

    next: (response: any) => {

      this.liveTickets =
        (response.tickets || []).map((ticket: any) => {

          return {

            ticketId:
              ticket.ticketId,

            status:
              ticket.status,

            channel:
              ticket.channel,

            createdAt:
              ticket.createdAt,

            zendeskUrl:
              `https://cxperts-63539.zendesk.com/agent/tickets/${ticket.ticketId}`

          };

        });

      this.loadingTickets = false;
    },

    error: (err: any) => {

      console.error(
        'Zendesk live error',
        err
      );

      this.loadingTickets = false;
    }

  });

  }
  catch (err) {

    console.error(err);

    this.loadingTickets = false;
  }

}

closeTicketModal() {

  this.showTicketModal = false;

  this.liveTickets = [];
}
  // =========================================================
  // CHART
  // =========================================================

  buildChart(data: any[]) {

    return {
      autoSize: true,
      height: 360,

      data,

      series: [{
        type: 'line',
        xKey: 'time',
        yKey: 'value',
        strokeWidth: 4,
        marker: {
          enabled: false
        }
      }],

      axes: [
        {
          type: 'category',
          position: 'bottom'
        },
        {
          type: 'number',
          position: 'left'
        }
      ],

      legend: {
        enabled: false
      }
    };

  }

}