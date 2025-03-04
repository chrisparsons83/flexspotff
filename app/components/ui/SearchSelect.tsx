import React, { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';

type SearchSelectProps = {
    options: string[];
    className?: string;
    onOptionSelect: (option: string) => void;
    onOptionSelectedChange: (isSelected: boolean) => void;
    value?: string;
};

export default function SearchSelect({
    options,
    className,
    onOptionSelect,
    onOptionSelectedChange,
    value = '',
}: SearchSelectProps) {
    const [query, setQuery] = useState(value);
    const [filteredOptions, setFilteredOptions] = useState<string[]>(options);
    const [isOptionSelected, setIsOptionSelected] = useState(value !== '');
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [isFocused, setIsFocused] = useState(false);
    const listRef = useRef<HTMLUListElement>(null);

    // Update query when value changes
    useEffect(() => {
        setQuery(value);
        setIsOptionSelected(value !== '');
    }, [value]);

    // Check if the query is an option and ignore case
    useEffect(() => {
        const isSelected = options.some(option => option.toLowerCase() === query.toLowerCase());
        setIsOptionSelected(isSelected);
        onOptionSelectedChange(isSelected);
    }, [query, options, onOptionSelectedChange]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        if (value.length < query.length) {
            setIsOptionSelected(false);
            onOptionSelectedChange(false);
        }
        setQuery(value);
        setFilteredOptions(
            options.filter(option =>
                option.toLowerCase().includes(value.toLowerCase())
            )
        );
        setHighlightedIndex(-1);
    };

    const handleSelect = (option: string) => {
        setQuery(option);
        setFilteredOptions([option]);
        setIsOptionSelected(true);
        onOptionSelect(option);
        onOptionSelectedChange(true);
        setHighlightedIndex(-1);
        setIsFocused(false);
    };

    // Allow scrolling through options with arrow keys and selecting with enter
    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (filteredOptions.length === 0) return;

        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
            setHighlightedIndex((prevIndex) =>
                prevIndex < filteredOptions.length - 1 ? prevIndex + 1 : 0
            );
        } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
            setHighlightedIndex((prevIndex) =>
                prevIndex > 0 ? prevIndex - 1 : filteredOptions.length - 1
            );
        } else if (event.key === 'Enter') {
            if (highlightedIndex >= 0) {
                handleSelect(filteredOptions[highlightedIndex]);
            } else if (filteredOptions.length > 0) {
                handleSelect(filteredOptions[0]);
            }
        } else if (event.key === 'Escape') {
            setIsFocused(false);
        }
    };

    useEffect(() => {
        if (highlightedIndex >= 0 && listRef.current) {
            const listItem = listRef.current.children[highlightedIndex] as HTMLElement;
            listItem.scrollIntoView({ block: 'nearest' });
        }
    }, [highlightedIndex]);

    return (
        <div className={clsx(className, 'relative')}>
            <input
                type="text"
                value={query}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => {
                    // Small delay to allow click events to fire on options
                    setTimeout(() => setIsFocused(false), 200);
                }}
                className="w-full px-4 py-2 border rounded-md bg-transparent"
            />
            {isFocused && query && filteredOptions.length > 0 && !isOptionSelected && (
                <ul ref={listRef} className="absolute z-10 w-full border rounded-md bg-slate-700 max-h-40 overflow-y-auto text-white marker:text-white top-full mt-1">
                    {filteredOptions.slice(0, 5).map((option, index) => (
                        <li
                            key={option}
                            onClick={() => handleSelect(option)}
                            className={clsx(
                                'px-4 py-2 cursor-pointer hover:bg-slate-500 relative',
                                { 'bg-slate-500': index === highlightedIndex }
                            )}
                        >
                            {option}
                            {index < filteredOptions.slice(0, 5).length - 1 && (
                                <div className="absolute bottom-0 left-0 w-[90%] h-[1px] bg-gray-500"></div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}