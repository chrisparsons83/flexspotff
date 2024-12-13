import React, { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';

type SearchSelectProps = {
    options: string[];
    className?: string;
    onOptionSelect: (option: string) => void;
    onOptionSelectedChange: (isSelected: boolean) => void;
};

export default function SearchSelect({
    options,
    className,
    onOptionSelect,
    onOptionSelectedChange,
}: SearchSelectProps) {
    const [query, setQuery] = useState('');
    const [filteredOptions, setFilteredOptions] = useState<string[]>(options);
    const [isOptionSelected, setIsOptionSelected] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const listRef = useRef<HTMLUListElement>(null);

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
                className="w-full px-4 py-2 border rounded-md bg-transparent"
            />
            {query && filteredOptions.length > 0 && !isOptionSelected && (
                <ul ref={listRef} className="absolute z-10 w-full border rounded-md bg-slate-700 max-h-40 overflow-y-auto text-white marker:text-white top-full mt-1">
                    {filteredOptions.slice(0, 5).map((option, index) => (
                        <li
                            key={option}
                            onClick={() => handleSelect(option)}
                            className={clsx(
                                'px-4 py-2 cursor-pointer hover:bg-slate-500',
                                { 'bg-slate-500': index === highlightedIndex }
                            )}
                        >
                            {option}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}