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
  selector: 'app-kimco-cases',
  standalone: true,
  imports: [
    CommonModule,
    AgCharts
  ],
  templateUrl: './kimco-cases.html',
  styleUrl: './kimco-cases.css'
})
export class KimcoCases implements OnInit {

  constructor(private api: AppeasementService) {}

  // =========================================================
  // STATE
  // =========================================================

  loading = false;

  metrics = {
    total: 0,
    success: 0,
    failed: 0,
    successRate: 0
  };

  chartOptions: any = {};
  pieOptions: any = {};

  cases: any[] = [];

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

  this.api
    .getKimcoCasesDashboard()
    .subscribe({

      next: (res: any) => {

        this.metrics =
          res.metrics || {

            total: 0,
            success: 0,
            failed: 0,
            successRate: 0
          };

        this.chartOptions =
          this.buildLineChart(
            res.timeline || []
          );

        this.pieOptions =
          this.buildPieChart();

        this.cases =
          res.cases || [];

        this.loading = false;
      },

      error: (err: any) => {

        console.error(err);

        this.loading = false;
      }

    });

}
  // =========================================================
  // CHARTS
  // =========================================================

  buildLineChart(data: any[]) {

    return {

      autoSize: true,

      height: 180,

      data,

      series: [
        {
          type: 'line',
          xKey: 'time',
          yKey: 'total',
          strokeWidth: 4,
          marker: {
            enabled: true,
            size: 8
          }
        }
      ],

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

  buildPieChart() {

  return {

    autoSize: true,

    height: 180,

    padding: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    },

    data: [
      {
        type: 'Success',
        value: this.metrics.success
      },
      {
        type: 'Failed',
        value: this.metrics.failed
      }
    ],

    series: [
      {
        type: 'pie',

        angleKey: 'value',

        legendItemKey: 'type',

        innerRadiusRatio: 0.65,

        strokeWidth: 0,

        sectorLabelKey: 'value',

        sectorLabel: {
          color: '#ffffff',
          fontWeight: '700',
          fontSize: 12
        },

        calloutLabel: {
          enabled: false
        }
      }
    ],

    legend: {
      enabled: false
    }

  };

}
  // =========================================================
  // HELPERS
  // =========================================================

  formatError(error: any): string {

    if (!error) {
      return '-';
    }

    return `${error.error} - ${error.error_description}`;
  }

}