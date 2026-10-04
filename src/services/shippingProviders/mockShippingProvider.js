const crypto = require('crypto');

class MockShippingProvider {
  constructor() {
    this.name = 'mock';
  }

  async createShipment(fulfillment, order, seller) {
    const awb = `MOCK-AWB-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const tracking = `TRK-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    
    // Estimate delivery in 4 days
    const estDate = new Date();
    estDate.setDate(estDate.getDate() + 4);

    return {
      success: true,
      provider: this.name,
      awbNumber: awb,
      trackingNumber: tracking,
      trackingUrl: `https://mock-courier.example.com/track/${tracking}`,
      estimatedDeliveryDate: estDate
    };
  }

  async cancelShipment(shipment) {
    return {
      success: true,
      message: 'Shipment cancelled'
    };
  }
}

module.exports = new MockShippingProvider();
