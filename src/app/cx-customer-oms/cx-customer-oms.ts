import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cx-customer-oms',
  standalone: true,
  imports: [CommonModule],
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

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token');

    if (!this.token) {
      this.handleInvalidToken('Invalid access link.');
      return;
    }

    this.validateToken(this.token);
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
}