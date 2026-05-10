export function calculateDeliveryFee(distance) {
  if (distance <= 4) {
    return 50;
  } else {
    return 50 + (distance - 4) * 10;
  }
}
