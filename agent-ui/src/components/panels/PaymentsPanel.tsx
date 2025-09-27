const payments = {
  SupplyChain: [
    "Pay Manufacturer",
    "Pay Supplier",
    "Pay Customs",
    "Pay Logistics Provider",
    "Pay Insurance",
    "Pay Warehouse",
    "Pay Distributor",
    "Pay Retailer",
    "Pay Tax Authority",
    "Create Purchase Order"
  ],
  Payroll: [
    "Pay Employee",
    "Pay Contractor",
    "Pay Freelancer",
    "Pay Consultant"
  ],
  Finance: [
    "Pay Bank",
    "Pay Lender",
    "Pay Investor"
  ]
};

export default function PaymentsPanel({ addNode }) {
  return (
    <>
      <h2 className="text-lg font-semibold mb-4 text-cyan-300">Payments</h2>
      {Object.entries(payments).map(([category, actions]) => (
        <div key={category} className="mb-6">
          <h3 className="text-sm font-medium mb-2 text-gray-300">{category}</h3>
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <button
                key={action}
                onClick={() => addNode(category, action)}
                className="px-3 py-1 text-xs rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white transition"
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
