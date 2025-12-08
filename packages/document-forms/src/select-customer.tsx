export interface SelectCustomerProps {
  value?: string;
  onChange: (customerId: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * SelectCustomer Component
 *
 * Dropdown component for selecting a customer from the CRM.
 * TODO: Implement full customer selection with search and autocomplete
 */
export function SelectCustomer({
  value,
  onChange,
  disabled = false,
  placeholder = "Select customer...",
}: SelectCustomerProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full rounded border p-2"
    >
      <option value="">{placeholder}</option>
      {/* TODO: Load and display customers */}
    </select>
  );
}
