import {
  Component,
  OnInit
} from '@angular/core';

import {
  CommonModule
} from '@angular/common';

import {
  FormsModule
} from '@angular/forms';

import {
  AgCharts
} from 'ag-charts-angular';

import {
  AppeasementService
} from '../services/appeasement.service';

@Component({
  selector: 'app-bimi',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AgCharts
  ],
  templateUrl: './bimi.html',
  styleUrls: ['./bimi.css']
})
export class Bimi implements OnInit {

  constructor(
    private api: AppeasementService
  ) { }

  // =========================================================
  // FILTERS
  // =========================================================

  selectedBrand = 'haggar';

  selectedRange = 'this_week';

  // =========================================================
  // TIMEZONE
  // =========================================================

  timezone:
    'UTC'
    | 'EST'
    | 'EDT' = 'UTC';

  // =========================================================
  // DROPDOWNS
  // =========================================================

  brands = [

    {
      label: 'Haggar',
      value: 'haggar'
    },

    {
      label: 'Cole Haan',
      value: 'colehaan'
    },

    {
      label: 'Kimco',
      value: 'kimco'
    },

    {
      label: 'Marc Jacobs',
      value: 'marcjacobs'
    }

  ];

  ranges = [

    {
      label: 'Today',
      value: 'today'
    },

    {
      label: 'Yesterday',
      value: 'yesterday'
    },

    {
      label: 'This Week',
      value: 'this_week'
    },

    {
      label: 'Last Week',
      value: 'last_week'
    },

    {
      label: 'Two Weeks Ago',
      value: 'two_weeks_ago'
    },

    {
      label: 'Three Weeks Ago',
      value: 'three_weeks_ago'
    },

    {
      label: 'Four Weeks Ago',
      value: 'four_weeks_ago'
    },

    {
      label: 'Five Weeks Ago',
      value: 'five_weeks_ago'
    }

  ];

  // =========================================================
  // STATE
  // =========================================================

  loading = false;

  tickets: any[] = [];

  totalOpened = 0;

  totalClosed = 0;

  overviewChart: any;

  phoneCreatedChart: any;

  chatCreatedChart: any;

  emailCreatedChart: any;

  phoneCloseChart: any;

  chatCloseChart: any;

  emailCloseChart: any;

  // =========================================================
  // VIEW MODES
  // =========================================================

  viewModes: any = {

    phoneCreated: 'graph',

    chatCreated: 'graph',

    emailCreated: 'graph'

  };

  // =========================================================
// LAST UPDATED
// =========================================================

lastUpdated = '';

  // =========================================================
  // INIT
  // =========================================================

  ngOnInit(): void {

    this.loadDashboard();

  }

  // =========================================================
  // LOAD
  // =========================================================

  loadDashboard() {

    this.loading = true;

    this.api.getBimiDashboard(

      this.selectedBrand,

      this.selectedRange,

      this.timezone

    ).subscribe({

      next: (res: any) => {
        this.tickets =
          res.tickets || [];

        this.processDashboard();

        this.lastUpdated = new Date().toLocaleString();

        this.loading = false;

      },

      error: (err: any) => {

        console.error(err);

        this.loading = false;

      }

    });

  }

  // =========================================================
  // PROCESS
  // =========================================================

  processDashboard() {

    // =====================================================
    // OVERVIEW
    // =====================================================

    this.totalOpened =
      this.tickets.length;

    this.totalClosed =
      this.tickets.filter(t =>

        ['solved', 'closed']
          .includes(
            (t.status || '')
              .toLowerCase()
          )

      ).length;

    // =====================================================
    // OVERVIEW DATA
    // =====================================================

    const allDays =
      this.extractDays();

    const overviewData =

      allDays.map(day => {

        const dayTickets =

          this.tickets.filter(t =>

            this.getDay(
              t.created_at
            ) === day

          );

        const opened =
          dayTickets.length;

        const closed =

          dayTickets.filter(t =>

            ['solved', 'closed']
              .includes(
                (t.status || '')
                  .toLowerCase()
              )

          ).length;

        return {

          day,

          opened,

          closed

        };

      });

    // =====================================================
    // MAIN CHART
    // =====================================================

    this.overviewChart =

      this.buildDoubleLineChart(

        overviewData,

        'opened',

        'closed'

      );

    // =====================================================
    // CREATED CHARTS
    // =====================================================

    this.phoneCreatedChart =
      this.buildCreatedChart(
        'phone'
      );

    this.chatCreatedChart =
      this.buildCreatedChart(
        'chat'
      );

    this.emailCreatedChart =
      this.buildCreatedChart(
        'email'
      );

    // =====================================================
    // CLOSE RATE
    // =====================================================

    this.phoneCloseChart =
      this.buildCloseRateChart(
        'phone'
      );

    this.chatCloseChart =
      this.buildCloseRateChart(
        'chat'
      );

    this.emailCloseChart =
      this.buildCloseRateChart(
        'email'
      );

  }

  // =========================================================
  // TIMEZONE
  // =========================================================

  setTimezone(
    timezone: 'UTC' | 'EST' | 'EDT'
  ) {

    this.timezone = timezone;

    // =====================================================
    // RELOAD FROM API
    // =====================================================

    this.loadDashboard();

  }

  // =========================================================
  // TOGGLE VIEW
  // =========================================================

  toggleView(
    key: string
  ) {

    this.viewModes[key] =

      this.viewModes[key] === 'graph'

        ? 'table'

        : 'graph';

  }

  // =========================================================
  // CHANNEL TOTAL
  // =========================================================

  getChannelTotal(
    channel: string
  ): number {

    return this.tickets.filter(t =>

      this.normalizeChannel(
        t.channel
      ) === channel

    ).length;

  }

  // =========================================================
  // DATE HELPERS
  // =========================================================

  formatDateByTimezone(
    date: string
  ): Date {

    const utcDate =
      new Date(date);

    // =====================================================
    // UTC
    // =====================================================

    if (this.timezone === 'UTC') {

      return utcDate;

    }

    // =====================================================
    // EST
    // =====================================================

    if (this.timezone === 'EST') {

      return new Date(

        utcDate.getTime()

        -

        (
          5 *
          60 *
          60 *
          1000
        )

      );

    }

    // =====================================================
    // EDT
    // =====================================================

    return new Date(

      utcDate.getTime()

      -

      (
        4 *
        60 *
        60 *
        1000
      )

    );

  }

  // =========================================================
  // GET DAY
  // =========================================================

  getDay(
    date: string
  ): string {

    const d =
      this.formatDateByTimezone(
        date
      );

    const year =
      d.getFullYear();

    const month =
      String(
        d.getMonth() + 1
      ).padStart(2, '0');

    const day =
      String(
        d.getDate()
      ).padStart(2, '0');

    return `${year}-${month}-${day}`;

  }

  // =========================================================
  // EXTRACT DAYS
  // =========================================================

  extractDays(): string[] {

    const days =

      this.tickets.map(t =>

        this.getDay(
          t.created_at
        )

      );

    return [

      ...new Set(days)

    ].sort();

  }

  // =========================================================
  // CHANNELS
  // =========================================================

  normalizeChannel(
    channel: string
  ): string {

    const c =
      (channel || '')
        .toLowerCase();

    // =====================================================
    // PHONE
    // =====================================================

    if (

      c.includes('voice')

      ||

      c.includes('phone')

      ||

      c.includes('api')

      ||

      c.includes('outbound')

      ||

      c.includes('inbound')

    ) {

      return 'phone';

    }

    // =====================================================
    // CHAT
    // =====================================================

    if (

      c.includes('chat')

      ||

      c.includes('messaging')

      ||

      c.includes('native_messaging')

    ) {

      return 'chat';

    }

    // =====================================================
    // EMAIL
    // =====================================================

    if (

      c.includes('mail')

      ||

      c.includes('email')

      ||

      c.includes('web')

    ) {

      return 'email';

    }

    return 'other';

  }

  // =========================================================
  // CREATED CHART
  // =========================================================

  buildCreatedChart(
    channel: string
  ) {

    const days =
      this.extractDays();

    const data =

      days.map(day => {

        const total =

          this.tickets.filter(t => {

            return (

              this.getDay(
                t.created_at
              ) === day

              &&

              this.normalizeChannel(
                t.channel
              ) === channel

            );

          }).length;

        return {

          day,

          value: total

        };

      });

    return this.buildSingleChart(
      data,
      'value'
    );

  }

  // =========================================================
  // CLOSE RATE CHART
  // =========================================================

  buildCloseRateChart(
    channel: string
  ) {

    const days =
      this.extractDays();

    const data =

      days.map(day => {

        const opened =

          this.tickets.filter(t => {

            return (

              this.getDay(
                t.created_at
              ) === day

              &&

              this.normalizeChannel(
                t.channel
              ) === channel

            );

          });

        const closed =

          opened.filter(t =>

            ['solved', 'closed']
              .includes(
                (t.status || '')
                  .toLowerCase()
              )

          );

        const percent =

          opened.length

            ?

            Number(

              (

                (
                  closed.length
                  /
                  opened.length
                )

                * 100

              ).toFixed(2)

            )

            :

            0;

        return {

          day,

          value: percent

        };

      });

    return this.buildSingleChart(
      data,
      'value'
    );

  }

  // =========================================================
  // SINGLE CHART
  // =========================================================

  buildSingleChart(
    data: any[],
    yKey: string
  ) {

    return {

      data,

      height: 260,

      autoSize: true,

      padding: {
        top: 20,
        right: 20,
        bottom: 30,
        left: 40
      },

      series: [

        {
          type: 'line',

          xKey: 'day',

          yKey,

          marker: {
            enabled: true,
            size: 6
          },

          strokeWidth: 3
        }

      ],

      axes: [

        {
          type: 'category',
          position: 'bottom',
          label: {
            rotation: 0,
            fontSize: 11
          }
        },

        {
          type: 'number',
          position: 'left',
          label: {
            fontSize: 11
          }
        }

      ],

      legend: {
        enabled: false
      }

    };

  }

  // =========================================================
  // DOUBLE LINE CHART
  // =========================================================

  buildDoubleLineChart(
    data: any[],
    openedKey: string,
    closedKey: string
  ) {

    return {

      data,

      height: 420,

      autoSize: true,

      padding: {
        top: 20,
        right: 20,
        bottom: 40,
        left: 50
      },

      series: [

        {
          type: 'line',

          xKey: 'day',

          yKey: openedKey,

          yName: 'Opened',

          marker: {
            enabled: true,
            size: 7
          },

          strokeWidth: 4
        },

        {
          type: 'line',

          xKey: 'day',

          yKey: closedKey,

          yName: 'Closed',

          marker: {
            enabled: true,
            size: 7
          },

          strokeWidth: 4
        }

      ],

      axes: [

        {
          type: 'category',
          position: 'bottom',
          label: {
            rotation: 0,
            fontSize: 12
          }
        },

        {
          type: 'number',
          position: 'left',
          label: {
            fontSize: 12
          }
        }

      ],

      legend: {
        enabled: true,
        position: 'bottom'
      }

    };

  }

}