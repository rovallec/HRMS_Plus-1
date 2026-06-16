import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppeasementService } from '../services/appeasement.service';

@Component({
  selector: 'app-cx-oms',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cx-oms.html',
  styleUrl: './cx-oms.css'
})
export class CxOms implements OnInit {

  constructor(
    private appeasementService: AppeasementService
  ) { }

  customers: any[] = [];
  filteredCustomers: any[] = [];
  selectedCustomerOrders: any[] = [];
  selectedOrderTrackings: any[] = [];

  selectedCustomer: any = null;
  selectedOrder: any = null;

  liveOrderResult: any = null;
  storedOrderResult: boolean = false;

  searchTerm: string = '';

  currentPage = 1;
  pageSize = 8;

  loadingOms = false;

  newOrderNumber: string = '';
  newPostalCode: string = '';
  newEmailAddress: string = '';
  newZipCode: string = '';
  newCaseNumber: string = '';

  agentEncouraged: boolean = false;
  customerKnew: boolean = false;
  customerComments: string = '';

  userBrands: { id: number; name: string }[] = [];
  selectedBrandId: string = '';


  collapsedNodes: { [key: string]: boolean } = {};

  currentUser: any = JSON.parse(localStorage.getItem('user') || '{}');

  activeOmsTab: string = 'order';

  ngOnInit(): void {

    this.appeasementService.getCustomers().subscribe((res: any) => {

      this.customers = res.data;
      this.filteredCustomers = [...res.data];

    });

    this.userBrands = this.currentUser?.brands || [];

    if (this.userBrands.length > 0) {
      this.selectedBrandId = String(this.userBrands[0].id);
    }
  }

  /* =====================================================
     MOCK DATA
  ===================================================== */

  generateMockCustomers() {

    return Array.from({ length: 25 }).map((_, i) => {

      const orders = Array.from({
        length: Math.ceil(Math.random() * 3)
      }).map((_, j) => {

        return {

          requestId:
            Math.floor(Math.random() * 999999),

          orderNumber:
            'ORD-' + (1000 + i * 10 + j),

          createdAt:
            new Date(),

          caseNumber:
            'CASE-' + (5000 + i + j),

          status:
            'TRACK GENERATED'

        };

      });

      return {

        name: `Customer ${i}`,

        email:
          `customer${i}@mail.com`,

        phone:
          `+502 5555-${1000 + i}`,

        orders

      };

    });

  }

  /* =====================================================
     SEARCH
  ===================================================== */

  search() {

    const term =
      this.searchTerm.toLowerCase();

    this.filteredCustomers =
      this.customers.filter(c =>

        c.name.toLowerCase().includes(term)
        ||
        c.email.toLowerCase().includes(term)
        ||
        c.phone.toLowerCase().includes(term)
        ||
        c.orders.some((o: any) =>

          o.orderNumber
            .toLowerCase()
            .includes(term)

        )

      );

    this.currentPage = 1;

  }

  /* =====================================================
     PAGINATION
  ===================================================== */

  get paginatedCustomers() {

    const start =
      (this.currentPage - 1)
      * this.pageSize;

    return this.filteredCustomers
      .slice(start, start + this.pageSize);

  }

  nextPage() {

    if (
      (this.currentPage * this.pageSize)
      <
      this.filteredCustomers.length
    ) {
      this.currentPage++;
    }

  }

  prevPage() {

    if (this.currentPage > 1) {
      this.currentPage--;
    }

  }

  /* =====================================================
     NAVIGATION
  ===================================================== */

  openCustomer(c: any) {
    this.appeasementService.getOrders(c.id).subscribe((res: any) => {
      this.selectedCustomerOrders = res.data;
    })
    this.selectedCustomer = c;
  }

  openOrder(order: any) {

    this.selectedOrder = order;

    this.appeasementService
      .getTrackings(order.id)
      .subscribe((res: any) => {

        this.selectedOrderTrackings = res.data;

      });

  }

  openTracking(tracking: any) {

    this.storedOrderResult = true;
    this.selectedBrandId = '1';

    let payload = tracking.payload;

    if (typeof payload === 'string') {
      payload = JSON.parse(payload);
    }

    this.liveOrderResult = payload;
  }

  backToCustomers() {
    this.selectedCustomer = null;
    this.selectedOrder = null;
    this.storedOrderResult = false;
    this.liveOrderResult = null;

  }

  backToOrders() {
    this.selectedCustomer = null;
    this.selectedOrder = null;
    this.storedOrderResult = false;
    this.liveOrderResult = null;
  }

  closeLiveResult() {
    this.selectedCustomer = null;
    this.selectedOrder = null;
    this.storedOrderResult = false;
    this.liveOrderResult = null;
    this.activeOmsTab = 'order';
  }

  /* =====================================================
     JSON HELPERS
  ===================================================== */

  getObjectKeys(obj: any): string[] {

    return Object.keys(obj || {});

  }

  isObject(value: any): boolean {

    return (
      value !== null
      &&
      typeof value === 'object'
      &&
      !Array.isArray(value)
    );

  }

  isArray(value: any): boolean {

    return Array.isArray(value);

  }

  isPrimitive(value: any): boolean {

    return (
      value === null
      ||
      typeof value !== 'object'
    );

  }

  hasChildren(value: any): boolean {

    return (
      this.isObject(value)
      ||
      this.isArray(value)
    );

  }

  toggleNode(path: string) {

    this.collapsedNodes[path] =
      !this.collapsedNodes[path];

  }

  isCollapsed(path: string): boolean {

    return this.collapsedNodes[path];

  }

  /* =====================================================
   CREATE TRACK
===================================================== */

  createTrack() {

    this.loadingOms = true;

    switch (this.selectedBrandId) {

      case '1':

        this.appeasementService
          .lookupCOLUSOrder(
            this.newOrderNumber,
            this.newEmailAddress,
            this.newPostalCode,
            this.newZipCode
          )
          .subscribe({

            next: (res) => {
              this.liveOrderResult = res.data;
              this.loadingOms = false;

              const modal =
                document.getElementById(
                  'newTrackModal'
                );

              if (modal) {

                const bootstrapModal =
                  (window as any)
                    .bootstrap
                    .Modal
                    .getInstance(modal);

                bootstrapModal?.hide();

              }

              // ======================================================
              // SAVE RESULT (NEW STEP)
              // ======================================================
              console.log(res.data);
              console.log(this.newOrderNumber);
              this.appeasementService.saveResult({
                oms: res.data,
                orderNumber: this.newOrderNumber,
                email: this.newEmailAddress,
                origin: 'OMS',
                httpCode: res.httpCode
              }).subscribe({
                next: (saveRes) => {
                  console.log('SAVE RESULT OK', saveRes);
                },
                error: (err) => {
                  console.error('SAVE RESULT FAILED', err);
                }

              });

            },

            error: (err) => {

              console.error(err);

              this.loadingOms = false;

              alert('OMS lookup failed');

            }
          });
        break;

      case '3':

        this.appeasementService
          .lookupMjOrder(this.newOrderNumber)
          .subscribe({

            next: (res) => {

              console.log('OMS RESPONSE', res);

              this.liveOrderResult = res;

              this.loadingOms = false;

              const modal =
                document.getElementById(
                  'newTrackModal'
                );

              if (modal) {

                const bootstrapModal =
                  (window as any)
                    .bootstrap
                    .Modal
                    .getInstance(modal);

                bootstrapModal?.hide();

              }

              this.resetForm();

            },

            error: (err) => {

              console.error(err);

              this.loadingOms = false;

              alert('OMS lookup failed');

            }

          });

        break;

      default:

        this.loadingOms = false;

        break;

    }

  }

  resetForm() {

    this.newOrderNumber = '';
    this.newZipCode = '';
    this.newCaseNumber = '';

    this.agentEncouraged = false;
    this.customerKnew = false;
    this.customerComments = '';

  }

  isFilled(): boolean {
    switch (this.selectedBrandId) {
      case '1':
        return (!!this.newOrderNumber || !!this.newEmailAddress);
        break;

      default:
        return false
        break;
    }
  }
}