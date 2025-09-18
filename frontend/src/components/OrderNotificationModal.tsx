import React from 'react';

interface OrderNotificationModalProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus: (orderId: string, status: string) => void;
  onViewOrder: (orderId: string) => void;
}

const OrderNotificationModal: React.FC<OrderNotificationModalProps> = ({
  order,
  isOpen,
  onClose,
  onUpdateStatus,
  onViewOrder
}) => {
  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900">Order Details</h2>
          <p className="text-sm text-gray-500">Order #{order.order_id}</p>
          <div className="mt-4">
            <p>Customer: {order.customer_name}</p>
            <p>Amount: ₹{order.amount}</p>
            <p>Status: {order.status}</p>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderNotificationModal;
