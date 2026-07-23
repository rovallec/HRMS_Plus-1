import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppeasementService } from '../services/appeasement.service';

@Component({
  selector: 'app-cx-customer-oms',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cx-customer-oms.html',
  styleUrl: './cx-customer-oms.css'
})
export class CxCustomerOMS implements OnInit {

  token: string | null = null;

  // UI states
  isLoading: boolean = true;
  isValidToken: boolean = false;
  errorMessage: string = '';

  // Mock data (luego vendrá del API)
  customerData: any = null;
  orderData: any = null;
  orderNumber: string = '';
  email: string = '';
  sessionToken: string = '';
  attemptsRemaining: number = 0;
  requiresEmail: boolean = false;
  isSubmittingEmail: boolean = false;
  lookupError: string = '';
  canChangeOrderNumber: boolean = false;
  isEditingOrderNumber: boolean = false;

  constructor(private route: ActivatedRoute, private api: AppeasementService) {}

ngOnInit(): void {
  this.token = this.route.snapshot.paramMap.get('token');

  if (!this.token) {
    this.handleInvalidToken('Invalid access link.');
    return;
  }

  this.loadTracking(this.token);
}

  loadTracking(token: string) {

  this.isLoading = true;
  this.isValidToken = false;
  this.errorMessage = '';

  this.api.getTrackingByToken(token)
    .subscribe({
      next: (res: any) => {

  console.log('TRACKING RESPONSE:', res);

  if (!res.success) {
    this.handleInvalidToken(res.error || 'Invalid or expired link.');
    return;
  }

  // 🔥 FIX: backend no usa "payload", usa "data" o "order"
const payload = res.payload;
this.orderNumber = res.orderNumber || payload?.order?.orderNumber || '';
this.sessionToken = res.sessionToken || '';
this.attemptsRemaining = res.attemptsRemaining ?? 0;
this.canChangeOrderNumber = res.canChangeOrderNumber === true;
this.requiresEmail = !payload && this.attemptsRemaining > 0;
this.orderData = payload?.order || null;

  this.isValidToken = true;
  this.isLoading = false;
},

      error: (err) => {
        console.error(err);
        this.handleInvalidToken('Server error or invalid request.');
      }

    });
}

  // 🔥 Simulación de validación (reemplazar con API)
  validateToken(token: string) {
    setTimeout(() => {
      // 👉 Simulación: cualquier token "123" es válido
      if (token === '123') {
        this.isValidToken = true;
        this.loadMockData();
      } else {
        this.handleInvalidToken('Token expired or invalid.');
      }

      this.isLoading = false;
    }, 1000);
  }

  handleInvalidToken(message: string) {
    this.isValidToken = false;
    this.errorMessage = message;
    this.isLoading = false;
  }

  // 🔥 Data mock
  loadMockData() {
    this.customerData = {
      name: 'John Doe',
      email: 'john.doe@email.com',
      phone: '+1 555-123-4567'
    };

    this.orderData = {
      orderNumber: 'ORD-789456',
      zipCode: '90210',
      status: 'Shipped',
      date: '2026-04-05'
    };
  }

  submitEmail(): void {
    if (!this.token || !this.sessionToken || this.isSubmittingEmail) return;

    const email = this.email.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.lookupError = 'Please enter a valid email address.';
      return;
    }

    this.isSubmittingEmail = true;
    this.lookupError = '';

    const changedOrderNumber = this.isEditingOrderNumber ? this.orderNumber.trim() : undefined;
    if (this.isEditingOrderNumber && !changedOrderNumber) {
      this.lookupError = 'Please enter a valid order number.';
      return;
    }
    if (this.isEditingOrderNumber) {
      this.canChangeOrderNumber = false;
      this.isEditingOrderNumber = false;
    }

    this.api.lookupCustomerTracking(this.token, this.sessionToken, email, changedOrderNumber).subscribe({
      next: (res: any) => {
        this.isSubmittingEmail = false;
        this.attemptsRemaining = res.attemptsRemaining ?? this.attemptsRemaining;
        this.canChangeOrderNumber = res.canChangeOrderNumber ?? this.canChangeOrderNumber;

        if (!res.success) {
          this.lookupError = res.error || 'We could not find the order with that email address.';
          this.requiresEmail = this.attemptsRemaining > 0;
          return;
        }

        this.orderData = res.payload?.order || null;
        this.requiresEmail = false;
      },
      error: (err) => {
        this.isSubmittingEmail = false;
        this.attemptsRemaining = err.error?.attemptsRemaining ?? this.attemptsRemaining;
        this.canChangeOrderNumber = err.error?.canChangeOrderNumber ?? this.canChangeOrderNumber;
        this.requiresEmail = this.attemptsRemaining > 0;
        this.lookupError = err.error?.error || 'The order service is unavailable. Please try again.';
      }
    });
  }

  enableOrderNumberEdit(): void {
    if (!this.canChangeOrderNumber) return;
    this.isEditingOrderNumber = true;
  }
}
