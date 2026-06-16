import { NgFor, DatePipe, NgIf, KeyValuePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AppeasementService } from '../services/appeasement.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-kimco-property-management',
  standalone: true,
  imports: [NgFor, DatePipe, NgIf, FormsModule, KeyValuePipe],
  templateUrl: './kimco-property-management.html',
  styleUrl: './kimco-property-management.css'
})
export class KimcoPropertyManagement implements OnInit {

  data: any = null;

  buildingId: string = '';
  tenantId: string = '';

  loading: boolean = false;

  // ================= MODAL STATE =================
  selectedType: string = '';
  selectedItem: any = null;
  selectedList: any[] = [];
  modalMode: 'single' | 'list' = 'single';


  // ================== SEARCH =====================
  searchText = '';
  showSearchModal = false;
  searchTree: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private api: AppeasementService
  ) {}

  // ================= INIT =================
  ngOnInit(): void {

    this.route.queryParams.subscribe(params => {

      this.buildingId = params['buildingId'] ?? '';
      this.tenantId = params['tenantId'] ?? '';

      if (this.buildingId) {
        this.loadData();
      }

    });

  }

  // ================= LOAD DATA (FIXED - OBSERVABLE SAFE) =================
loadData(): void {

  this.loading = true;

  this.api.getKimcoPropertyManagement({
    buildingId: this.buildingId,
    tenantId: this.tenantId
  })
  .subscribe({

    next: (res: any) => {
      this.data = res?.data ?? null;
      this.loading = false;
    },

    error: (err: any) => {
      console.error('Property Management error', err);
      this.loading = false;
    }

  });

}

  // ================= PREVIEW HELPERS =================
  slice(arr: any[] = []): any[] {
    return arr ? arr.slice(0, 5) : [];
  }

  hasMore(arr: any[] = []): boolean {
    return arr && arr.length > 5;
  }

  // ================= MODAL CONTROL =================
  openModal(type: string, item: any): void {

    this.selectedType = type;

    if (Array.isArray(item)) {

      this.modalMode = 'list';
      this.selectedList = item;
      this.selectedItem = null;

    } else {

      this.modalMode = 'single';
      this.selectedItem = item;
      this.selectedList = [];

    }

  }

  closeModal(): void {

    this.selectedType = '';
    this.selectedItem = null;
    this.selectedList = [];
    this.modalMode = 'single';

  }

  runSearch(): void {

  const term = this.searchText?.trim().toLowerCase();

  if (!term) {
    return;
  }

  const groups: any = {};

  const addMatch = (
    section: string,
    title: string,
    data: any
  ) => {

    if (!groups[section]) {

      groups[section] = {
        name: section,
        expanded: true,
        items: []
      };

    }

    groups[section].items.push({
      title,
      expanded: false,
      data
    });

  };

  const searchArray = (
    arr: any[],
    section: string,
    titleField: string
  ) => {

    (arr || []).forEach(item => {

      const text = JSON.stringify(item)
        .toLowerCase();

      if (text.includes(term)) {

        addMatch(
          section,
          item[titleField] || 'Item',
          item
        );

      }

    });

  };

  searchArray(
    this.data?.lease_personnel,
    'Lease Personnel',
    'name'
  );

  searchArray(
    this.data?.vendors,
    'Vendors',
    'vendor_name'
  );

  searchArray(
    this.data?.utility_providers,
    'Utility Providers',
    'vendor_name'
  );

  searchArray(
    this.data?.contacts,
    'Contacts',
    'name'
  );

  searchArray(
    this.data?.emergency_responders,
    'Emergency Responders',
    'account_name'
  );

  searchArray(
    this.data?.building_notes,
    'Building Notes',
    'title'
  );

  this.searchTree = Object.values(groups);

  this.showSearchModal = true;
}

toggleGroup(group: any): void {

  group.expanded = !group.expanded;

}

toggleItem(item: any): void {

  item.expanded = !item.expanded;

}

closeSearchModal(): void {

  this.showSearchModal = false;
  this.searchTree = [];

}
}