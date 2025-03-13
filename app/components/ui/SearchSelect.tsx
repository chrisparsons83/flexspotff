import React, { useState, useEffect, useRef, useCallback } from 'react';
import clsx from 'clsx';

type SearchSelectProps = {
    options: string[];
    className?: string;
    onOptionSelect: (option: string) => void;
    onOptionSelectedChange: (value: string) => void;
    value?: string;
    disabled?: boolean;
    textColor?: string;
};

export default function SearchSelect({
    options,
    className,
    onOptionSelect,
    onOptionSelectedChange,
    value = '',
    disabled = false,
    textColor,
}: SearchSelectProps) {
    // Initialize state with the value prop to ensure consistency between server and client
    const [query, setQuery] = useState(value);
    const [filteredOptions, setFilteredOptions] = useState<string[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedOption, setSelectedOption] = useState<string>(value);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLUListElement>(null);
    const isDeleting = useRef(false);

    // Update query and selected option when value prop changes
    useEffect(() => {
        // Only update if we're not actively deleting and value is different
        if (!isDeleting.current && value !== query) {
            setQuery(value);
            setSelectedOption(value);
        }
    }, [value, query]);

    // Handle input change
    const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        if (disabled) return;
        
        const newValue = event.target.value;
        const isBackspaceDelete = query.length > newValue.length;
        isDeleting.current = isBackspaceDelete;

        setQuery(newValue);

        // If input is empty or only whitespace, clear all states
        if (!newValue.trim()) {
            setQuery('');
            setSelectedOption('');
            onOptionSelect('');
            onOptionSelectedChange('');
            setFilteredOptions([]);
            return;
        }

        // Filter options based on input
        const filtered = options
            .filter(option => 
                option.toLowerCase().includes(newValue.toLowerCase()))
            .slice(0, 3);
        
        setFilteredOptions(filtered);
        
        // If exact match found, update selection
        const exactMatch = options.find(
            opt => opt.toLowerCase() === newValue.toLowerCase()
        );
        if (exactMatch) {
            setSelectedOption(exactMatch);
            onOptionSelect(exactMatch);
            onOptionSelectedChange(exactMatch);
        } else {
            setSelectedOption(newValue);
            onOptionSelectedChange(newValue);
        }

        // Reset deletion flag after state updates
        setTimeout(() => {
            isDeleting.current = false;
        }, 0);
    }, [disabled, options, onOptionSelect, onOptionSelectedChange, query]);

    // Handle option selection from dropdown
    const handleOptionSelect = useCallback((option: string) => {
        if (disabled) return;
        
        isDeleting.current = false;
        setQuery(option);
        setSelectedOption(option);
        setIsOpen(false);
        onOptionSelect(option);
        onOptionSelectedChange(option);
        setFilteredOptions([]);
    }, [disabled, onOptionSelect, onOptionSelectedChange]);

    // Handle input focus
    const handleFocus = useCallback(() => {
        if (disabled) return;
        
        setIsOpen(true);
        // Show top 3 matching options on focus
        const filtered = options
            .filter(option => 
                option.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 3);
        setFilteredOptions(filtered);
    }, [disabled, options, query]);

    // Handle click outside
    useEffect(() => {
        // Only add event listener on the client side
        if (typeof window === 'undefined') return;
        
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
                inputRef.current && !inputRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setFilteredOptions([]);
                
                // Only revert if not actively deleting and there's a query
                if (!isDeleting.current && query.trim() && 
                    !options.find(opt => opt.toLowerCase() === query.toLowerCase())) {
                    setQuery(selectedOption);
                    onOptionSelectedChange(selectedOption);
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [options, query, selectedOption, onOptionSelectedChange]);

    // Handle keyboard navigation
    const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
        if (disabled) return;

        // Handle backspace/delete keys
        if (event.key === 'Backspace' || event.key === 'Delete') {
            isDeleting.current = true;
            return;
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            if (filteredOptions.length > 0) {
                handleOptionSelect(filteredOptions[0]);
            } else if (!query.trim()) {
                // If empty or whitespace, clear selection
                setSelectedOption('');
                onOptionSelect('');
                onOptionSelectedChange('');
            }
            setIsOpen(false);
        } else if (event.key === 'Escape') {
            setIsOpen(false);
            setFilteredOptions([]);
            // Only revert if not actively deleting
            if (!isDeleting.current) {
                setQuery(selectedOption);
                onOptionSelectedChange(selectedOption);
            }
        }
    }, [disabled, filteredOptions, handleOptionSelect, query, selectedOption, onOptionSelect, onOptionSelectedChange]);

    return (
        <div className={clsx(className, 'relative')}>
            <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleInputChange}
                onFocus={handleFocus}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                className={clsx(
                    "w-full px-4 py-2 border rounded-md bg-transparent",
                    disabled && "opacity-50 cursor-not-allowed",
                    textColor
                )}
            />
            {isOpen && filteredOptions.length > 0 && !disabled && (
                <ul 
                    ref={dropdownRef}
                    className="absolute z-10 w-full border rounded-md bg-slate-700 max-h-40 overflow-y-auto text-white marker:text-white top-full mt-1"
                >
                    {filteredOptions.map((option, index) => (
                        <li
                            key={option}
                            onClick={() => handleOptionSelect(option)}
                            className={clsx(
                                'px-4 py-2 cursor-pointer hover:bg-slate-500 relative'
                            )}
                        >
                            {option}
                            {index < filteredOptions.length - 1 && (
                                <div className="absolute bottom-0 left-0 w-[90%] h-[1px] bg-gray-500"></div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}