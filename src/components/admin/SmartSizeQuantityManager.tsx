import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  X,
  Layers,
  Shirt,
  Package,
  Droplets,
  Scale,
  Cpu,
  Boxes,
  Sliders,
  Info,
  DollarSign,
  Hash,
  RefreshCw,
  Ruler,
  Car,
  Palette,
  CheckSquare,
  ListPlus
} from 'lucide-react';
import type { ProductVariant } from '../../types';
import {
  DEFAULT_12_COLORS,
  getNearestColorName,
  isValidHex,
  normalizeHex,
  StandardColor
} from '../../utils/colorNaming';

export type PresetCategoryType =
  | 'standard_sizes'
  | 'fashion_clothing'
  | 'footwear'
  | 'toys_cars'
  | 'dimensions'
  | 'packets_pieces'
  | 'food_weight'
  | 'beverages'
  | 'electronics';

export interface SizeQuantityOption {
  id: string;
  name: string; // e.g. "250 ml", "500 ml", "1 kg", "M", "42", "1 Piece"
  sku?: string;
  stock: number;
  price?: number; // optional price override in ৳
  colorName?: string; // e.g. "Navy Blue / নেভি ব্লু"
  colorCode?: string; // e.g. "#1B365D"
}

interface SmartSizeQuantityManagerProps {
  category: string;
  subcategory?: string;
  productSku?: string;
  basePrice: number;
  options: SizeQuantityOption[];
  onChange: (updatedOptions: SizeQuantityOption[]) => void;
  optionTitle?: string;
  onOptionTitleChange?: (title: string) => void;
}

interface PresetGroup {
  id: PresetCategoryType;
  titleBn: string;
  titleEn: string;
  icon: React.ReactNode;
  defaultUnit: string;
  standardSuggestions: string[];
  extraSuggestions: string[];
  commonUnits: string[];
}

export const PRESET_GROUPS: PresetGroup[] = [
  {
    id: 'standard_sizes',
    titleBn: 'পোশাক ও সাধারণ সাইজ (S, M, L, XL)',
    titleEn: 'Standard Sizes (সাইজ)',
    icon: <Ruler className="w-4 h-4 text-indigo-600" />,
    defaultUnit: '',
    standardSuggestions: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Free Size'],
    extraSuggestions: ['28', '30', '32', '34', '36', '38', '40', '42', 'One Size'],
    commonUnits: ['None', 'Piece', 'Set', 'পিস']
  },
  {
    id: 'footwear',
    titleBn: 'জুতার সাইজ (৩৯, ৪০, ৪১, ৪২, ৪৩, ৪৪, ৪৫)',
    titleEn: 'Shoe Sizes (জুতার সাইজ)',
    icon: <Boxes className="w-4 h-4 text-rose-600" />,
    defaultUnit: '',
    standardSuggestions: ['38', '39', '40', '41', '42', '43', '44', '45', '46'],
    extraSuggestions: ['35', '36', '37', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11'],
    commonUnits: ['None', 'Pair', 'Pairs', 'জোড়া']
  },
  {
    id: 'toys_cars',
    titleBn: 'খেলনা, গাড়ি ও স্কেল সাইজ (টয় ও ডাইকাস্ট)',
    titleEn: 'Toys & Car Sizes (গাড়ির সাইজ)',
    icon: <Car className="w-4 h-4 text-emerald-600" />,
    defaultUnit: 'Piece',
    standardSuggestions: ['1:18 Scale', '1:24 Scale', '1:32 Scale', '1:43 Scale', '1:64 Scale', 'Small', 'Medium', 'Large', '1 Piece', 'Set'],
    extraSuggestions: ['1:12 Scale', '1:36 Scale', '1:87 Scale', 'Mini', 'XL Size', '2 Pcs Set', 'Box Set'],
    commonUnits: ['Piece', 'Scale', 'Set', 'Box', 'পিস']
  },
  {
    id: 'dimensions',
    titleBn: 'আকার ও ডাইমেনশন সাইজ (ইঞ্চি / সেমি)',
    titleEn: 'Dimensions & Measure (ডাইমেনশন)',
    icon: <Layers className="w-4 h-4 text-teal-600" />,
    defaultUnit: 'inch',
    standardSuggestions: ['Small', 'Medium', 'Large', 'Extra Large', 'Standard', '10x8 inch', '12x10 inch', 'Free Size'],
    extraSuggestions: ['15x12 inch', '15 cm', '30 cm', '50 cm', '100 cm', '1 Meter', '2 Meters'],
    commonUnits: ['inch', 'cm', 'mm', 'Meter', 'Feet', 'Piece']
  },
  {
    id: 'packets_pieces',
    titleBn: 'প্যাকেট, বক্স ও পিসভিত্তিক পণ্য',
    titleEn: 'Packs, Boxes & Pieces',
    icon: <Package className="w-4 h-4 text-emerald-600" />,
    defaultUnit: 'Piece',
    standardSuggestions: [
      '1 Piece',
      '2 Pieces',
      '3 Pieces',
      '6 Pieces',
      '12 Pieces',
      '1 Box',
      '1 Pack',
      '1 Dozen'
    ],
    extraSuggestions: ['4 Pieces', '5 Pieces', '10 Pieces', '2 Boxes', '3 Packs', '2 Dozens'],
    commonUnits: ['Piece', 'Pieces', 'Pack', 'Packs', 'Box', 'Boxes', 'Bottle', 'Bottles', 'Dozen', 'Set']
  },
  {
    id: 'food_weight',
    titleBn: 'খাবার ও ওজনভিত্তিক পণ্য',
    titleEn: 'Food, Rice, Dal & Sugar',
    icon: <Scale className="w-4 h-4 text-amber-600" />,
    defaultUnit: 'g',
    standardSuggestions: ['100 g', '250 g', '500 g', '1 kg', '2 kg', '5 kg'],
    extraSuggestions: ['50 g', '400 g', '750 g', '3 kg', '10 kg', '25 kg'],
    commonUnits: ['g', 'kg', 'mg', 'Pound', 'Bag', 'Pack']
  },
  {
    id: 'beverages',
    titleBn: 'পানীয় ও তরল পণ্য',
    titleEn: 'Drinks & Beverages',
    icon: <Droplets className="w-4 h-4 text-sky-600" />,
    defaultUnit: 'ml',
    standardSuggestions: ['250 ml', '500 ml', '750 ml', '1 L', '1.5 L', '2 L'],
    extraSuggestions: ['330 ml', '600 ml', '1.25 L', '3 L', '5 L', '10 L'],
    commonUnits: ['ml', 'L', 'Piece', 'Bottle', 'Can', 'Pack', 'Case']
  },
  {
    id: 'electronics',
    titleBn: 'ইলেকট্রনিকস ও টেক',
    titleEn: 'Electronics & Gadgets',
    icon: <Cpu className="w-4 h-4 text-purple-600" />,
    defaultUnit: 'Piece',
    standardSuggestions: ['1 Piece', '1 Set', '1 Pair', '1 Pack', '1 Box', '1 Unit'],
    extraSuggestions: ['64GB', '128GB', '256GB', '512GB', '1TB', '4GB / 64GB', '8GB / 128GB'],
    commonUnits: ['Piece', 'Unit', 'Set', 'Pair', 'Pack', 'Box', 'GB', 'TB']
  }
];

export function detectPresetCategory(category = '', subcategory = ''): PresetCategoryType {
  const combined = `${category} ${subcategory}`.toLowerCase();

  if (/car|cars|toy|toys|খেলনা|গাড়ি|গাড়ি|কার\b|vehicle|truck|jeep|diecast|hotwheels|lego|robot|drone/i.test(combined)) {
    return 'toys_cars';
  }
  if (/shoe|footwear|জুতা|জুতো|স্নিকার্স|sneaker|sandal|কেডস|loafer|boot|স্যান্ডেল/i.test(combined)) {
    return 'footwear';
  }
  if (/dimension|ডাইমেনশন|পরিমাপ|মাপ|inch|cm|সেমি|ইঞ্চি|length|width|height/i.test(combined)) {
    return 'dimensions';
  }
  if (/drink|beverage|juice|তরল|শরবত|চা|কফি|tea|coffee|water|milk|oil|পানীয়|পানীয়|পানিয়|সয়াবিন/i.test(combined)) {
    return 'beverages';
  }
  if (/grocery|food|চাল|ডাল|আটা|চিনি|খাবার|খাদ্য|মসলা|rice|flour|sugar|spice|grain|meat|fish|sweet|মধু|honey/i.test(combined)) {
    return 'food_weight';
  }
  if (/pack|box|bundle|piece|ডজন|gift|প্যাকেট|বক্স|পিস|পিসভিত্তিক/i.test(combined)) {
    return 'packets_pieces';
  }
  if (/electronic|gadget|mobile|laptop|headphone|earphone|camera|cable|tech|ইলেকট্রনিক/i.test(combined)) {
    return 'electronics';
  }
  if (/cloth|fashion|t-shirt|shirt|polo|panjabi|hoodie|pant|trouser|jeans|dress|পোশাক|শার্ট|গেঞ্জি|পাঞ্জাবি|টি শার্ট|টি-শার্ট|প্যান্ট|size|সাইজ/i.test(combined)) {
    return 'standard_sizes';
  }

  return 'standard_sizes';
}

export const SmartSizeQuantityManager: React.FC<SmartSizeQuantityManagerProps> = ({
  category,
  subcategory,
  productSku = '',
  basePrice,
  options,
  onChange,
  optionTitle,
  onOptionTitleChange
}) => {
  // Auto-detect preset group based on category
  const detectedPreset = useMemo(() => detectPresetCategory(category, subcategory), [category, subcategory]);
  const [activePreset, setActivePreset] = useState<PresetCategoryType>(detectedPreset);

  // When category changes, switch preset smoothly without touching already added options
  useEffect(() => {
    setActivePreset(detectedPreset);
  }, [detectedPreset]);

  // Current active preset configuration
  const currentGroup =
    PRESET_GROUPS.find((g) => g.id === activePreset) ||
    PRESET_GROUPS.find((g) => activePreset === 'fashion_clothing' && g.id === 'standard_sizes') ||
    PRESET_GROUPS[0];

  // Custom Input State
  const [customValue, setCustomValue] = useState('');
  const [customUnit, setCustomUnit] = useState(currentGroup.defaultUnit || 'ml');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Bulk stock & price setters
  const [bulkStockVal, setBulkStockVal] = useState<string>('15');
  const [bulkPriceVal, setBulkPriceVal] = useState<string>('');

  // Color Selection Modal State
  // Color Selection Modal State
  // colorModalTargetId can be:
  // - null: modal closed
  // - 'all': applying color to all options
  // - 'multi_add': multi-color batch generation & addition mode
  // - string (option.id): applying color to specific option
  const [colorModalTargetId, setColorModalTargetId] = useState<string | null>(null);
  const [activeColorHex, setActiveColorHex] = useState<string>(DEFAULT_12_COLORS[0].hex);
  const [activeColorName, setActiveColorName] = useState<string>(
    `${DEFAULT_12_COLORS[0].nameBn} (${DEFAULT_12_COLORS[0].nameEn})`
  );
  const [customHexInput, setCustomHexInput] = useState<string>('');

  // Multi-color batch state
  const [selectedMultiColors, setSelectedMultiColors] = useState<
    Array<{ hex: string; nameBn: string; nameEn: string }>
  >([]);
  const [batchHexTextInput, setBatchHexTextInput] = useState<string>('');
  const [multiColorMode, setMultiColorMode] = useState<'create_options' | 'apply_existing'>('create_options');

  // Handler to open color picker modal
  const handleOpenColorModal = (targetId: string | 'all' | 'multi_add', initialHex?: string, initialName?: string) => {
    setColorModalTargetId(targetId);
    if (targetId === 'multi_add') {
      setSelectedMultiColors([]);
      setBatchHexTextInput('');
    } else if (initialHex && isValidHex(initialHex)) {
      const normalized = normalizeHex(initialHex);
      setActiveColorHex(normalized);
      setCustomHexInput(normalized);
      if (initialName) {
        setActiveColorName(initialName);
      } else {
        const resolved = getNearestColorName(normalized);
        setActiveColorName(`${resolved.nameBn} (${resolved.nameEn})`);
      }
    } else {
      setActiveColorHex(DEFAULT_12_COLORS[0].hex);
      setCustomHexInput(DEFAULT_12_COLORS[0].hex);
      setActiveColorName(`${DEFAULT_12_COLORS[0].nameBn} (${DEFAULT_12_COLORS[0].nameEn})`);
    }
  };

  // Select one of the 12 default retail colors (single mode)
  const handleSelectPresetColor = (color: StandardColor) => {
    setActiveColorHex(color.hex);
    setCustomHexInput(color.hex);
    setActiveColorName(`${color.nameBn} (${color.nameEn})`);
  };

  // Toggle color in multi-color selection
  const handleToggleMultiColor = (color: { hex: string; nameBn: string; nameEn: string }) => {
    const exists = selectedMultiColors.some(
      (c) => c.hex.toLowerCase() === color.hex.toLowerCase()
    );
    if (exists) {
      setSelectedMultiColors(
        selectedMultiColors.filter((c) => c.hex.toLowerCase() !== color.hex.toLowerCase())
      );
    } else {
      setSelectedMultiColors([...selectedMultiColors, color]);
    }
  };

  // Select all 12 default colors
  const handleSelectAll12MultiColors = () => {
    setSelectedMultiColors(
      DEFAULT_12_COLORS.map((c) => ({
        hex: c.hex,
        nameBn: c.nameBn,
        nameEn: c.nameEn
      }))
    );
  };

  // Clear all in multi-color selection
  const handleClearAllMultiColors = () => {
    setSelectedMultiColors([]);
  };

  // Add custom color to multi-color selection list
  const handleAddCustomToMultiList = (hexVal: string) => {
    if (!isValidHex(hexVal)) return;
    const normalized = normalizeHex(hexVal);
    const resolved = getNearestColorName(normalized);
    const exists = selectedMultiColors.some(
      (c) => c.hex.toLowerCase() === normalized.toLowerCase()
    );
    if (!exists) {
      setSelectedMultiColors([
        ...selectedMultiColors,
        { hex: normalized, nameBn: resolved.nameBn, nameEn: resolved.nameEn }
      ]);
    }
    setCustomHexInput('');
  };

  // Parse and add multiple hex codes from textarea (comma, space, or newline separated)
  const handleParseBatchHexText = () => {
    if (!batchHexTextInput.trim()) return;
    // split by comma, semicolon, space, or newline
    const tokens = batchHexTextInput.split(/[\s,;\n\r]+/).filter(Boolean);
    const newColors: Array<{ hex: string; nameBn: string; nameEn: string }> = [];

    tokens.forEach((t) => {
      const clean = t.trim();
      if (isValidHex(clean)) {
        const norm = normalizeHex(clean);
        if (
          !selectedMultiColors.some((c) => c.hex.toLowerCase() === norm.toLowerCase()) &&
          !newColors.some((c) => c.hex.toLowerCase() === norm.toLowerCase())
        ) {
          const resolved = getNearestColorName(norm);
          newColors.push({ hex: norm, nameBn: resolved.nameBn, nameEn: resolved.nameEn });
        }
      }
    });

    if (newColors.length > 0) {
      setSelectedMultiColors([...selectedMultiColors, ...newColors]);
      setBatchHexTextInput('');
    }
  };

  // Change custom hex code or HTML5 color input
  const handleCustomHexChange = (hexValue: string) => {
    setCustomHexInput(hexValue);
    if (isValidHex(hexValue)) {
      const normalized = normalizeHex(hexValue);
      setActiveColorHex(normalized);
      const resolved = getNearestColorName(normalized);
      setActiveColorName(`${resolved.nameBn} (${resolved.nameEn})`);
    }
  };

  // Apply selected color to target (single option or all options)
  const handleApplyColor = () => {
    if (!colorModalTargetId) return;

    if (colorModalTargetId === 'all') {
      onChange(
        options.map((opt) => ({
          ...opt,
          colorCode: activeColorHex,
          colorName: activeColorName
        }))
      );
    } else {
      onChange(
        options.map((opt) =>
          opt.id === colorModalTargetId
            ? { ...opt, colorCode: activeColorHex, colorName: activeColorName }
            : opt
        )
      );
    }
    setColorModalTargetId(null);
  };

  // Apply multiple colors to options (either creating new color variants or applying to existing options)
  const handleApplyMultiColors = () => {
    if (selectedMultiColors.length === 0) return;

    if (multiColorMode === 'create_options') {
      // 1. If options already exist, create variations with these colors, or add each color as a new option
      const newOptionsToAdd: SizeQuantityOption[] = [];

      if (options.length === 0) {
        // Create an option for each color directly
        selectedMultiColors.forEach((col, idx) => {
          const colorLabel = `${col.nameBn} (${col.nameEn})`;
          const skuSuffix = col.nameEn.replace(/[^a-zA-Z0-9]/g, '');
          newOptionsToAdd.push({
            id: `opt_${Date.now()}_col_${idx}`,
            name: col.nameBn,
            sku: productSku ? `${productSku}-${skuSuffix}` : skuSuffix,
            stock: 15,
            colorCode: col.hex,
            colorName: colorLabel
          });
        });
      } else {
        // If options already exist (e.g. S, M, L or 1:24, 1:32 or 1 Piece)
        // Check if any option is missing a color; if so, assign colors round-robin or expand
        // Let's create variants combining options x colors if fewer options, OR add each color as a variant
        selectedMultiColors.forEach((col, idx) => {
          const colorLabel = `${col.nameBn} (${col.nameEn})`;
          // Check if there is already an option with this exact color
          const alreadyHasColor = options.some(
            (o) => o.colorCode?.toLowerCase() === col.hex.toLowerCase()
          );

          if (!alreadyHasColor) {
            const skuSuffix = col.nameEn.replace(/[^a-zA-Z0-9]/g, '');
            newOptionsToAdd.push({
              id: `opt_${Date.now()}_col_${idx}`,
              name: `${options[0]?.name ? `${options[0].name} - ` : ''}${col.nameBn}`,
              sku: productSku ? `${productSku}-${skuSuffix}` : skuSuffix,
              stock: 15,
              colorCode: col.hex,
              colorName: colorLabel
            });
          }
        });
      }

      if (newOptionsToAdd.length > 0) {
        onChange([...options, ...newOptionsToAdd]);
      }
    } else {
      // 'apply_existing': Apply selected colors across existing options sequentially
      const updated = options.map((opt, i) => {
        const assignedColor = selectedMultiColors[i % selectedMultiColors.length];
        return {
          ...opt,
          colorCode: assignedColor.hex,
          colorName: `${assignedColor.nameBn} (${assignedColor.nameEn})`
        };
      });
      onChange(updated);
    }

    setColorModalTargetId(null);
  };

  // Remove/clear color from target
  const handleClearColor = (targetId: string | 'all' | 'multi_add') => {
    if (targetId === 'all') {
      onChange(
        options.map((opt) => ({
          ...opt,
          colorCode: undefined,
          colorName: undefined
        }))
      );
    } else if (targetId !== 'multi_add') {
      onChange(
        options.map((opt) =>
          opt.id === targetId
            ? { ...opt, colorCode: undefined, colorName: undefined }
            : opt
        )
      );
    }
    if (colorModalTargetId === targetId) {
      setColorModalTargetId(null);
    }
  };

  // Update default unit when preset switches
  useEffect(() => {
    setCustomUnit(currentGroup.defaultUnit || (currentGroup.commonUnits[0] === 'None' ? '' : currentGroup.commonUnits[0]));
    setDuplicateWarning(null);
  }, [activePreset]);

  // Clean option string generator
  const buildOptionString = (val: string, unit: string) => {
    const trimmedVal = val.trim();
    const trimmedUnit = unit.trim();
    if (!trimmedVal) return '';
    if (!trimmedUnit || trimmedUnit === 'None') return trimmedVal;
    return `${trimmedVal} ${trimmedUnit}`;
  };

  // Add an option to the list with duplicate detection
  const handleAddOption = (optionLabel: string) => {
    const trimmed = optionLabel.trim();
    if (!trimmed) return;

    // Check duplicate (case-insensitive)
    const exists = options.some(
      (opt) => opt.name.trim().toLowerCase() === trimmed.toLowerCase()
    );

    if (exists) {
      setDuplicateWarning(`"${trimmed}" ইতিমধ্যে অপশন তালিকায় যোগ করা আছে (Already exists).`);
      setTimeout(() => setDuplicateWarning(null), 3500);
      return;
    }

    setDuplicateWarning(null);

    const generatedId = `opt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const cleanSkuLabel = trimmed.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const generatedSku = productSku ? `${productSku}-${cleanSkuLabel}` : cleanSkuLabel;

    const newOption: SizeQuantityOption = {
      id: generatedId,
      name: trimmed,
      sku: generatedSku,
      stock: 15,
      price: undefined // defaults to product base price
    };

    onChange([...options, newOption]);
  };

  // Toggle option on/off (if present -> remove, if not present -> add)
  const handleToggleOption = (optionLabel: string) => {
    const trimmed = optionLabel.trim();
    if (!trimmed) return;

    const existingIndex = options.findIndex(
      (opt) => opt.name.trim().toLowerCase() === trimmed.toLowerCase()
    );

    if (existingIndex >= 0) {
      onChange(options.filter((_, idx) => idx !== existingIndex));
      setDuplicateWarning(null);
    } else {
      handleAddOption(trimmed);
    }
  };

  // Quick Unit Click Handler: typed number (or default 1) + clicked unit
  const handleQuickAddUnit = (unitStr: string) => {
    const num = customValue.trim() || '1';
    const label = buildOptionString(num, unitStr);
    handleAddOption(label);
    setCustomValue('');
  };

  // Pre-select popular clothing sizes M, L, XL
  const handlePreselectPopularClothing = () => {
    const popular = ['M', 'L', 'XL'];
    const currentNames = new Set(options.map((o) => o.name.toLowerCase()));
    const toAdd: SizeQuantityOption[] = [];

    popular.forEach((sz) => {
      if (!currentNames.has(sz.toLowerCase())) {
        toAdd.push({
          id: `opt_${Date.now()}_${sz}`,
          name: sz,
          sku: productSku ? `${productSku}-${sz}` : sz,
          stock: 15
        });
      }
    });

    if (toAdd.length > 0) {
      onChange([...options, ...toAdd]);
    }
  };

  // Pre-select all standard clothing sizes XS to XXL
  const handlePreselectAllClothing = () => {
    const all = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    const currentNames = new Set(options.map((o) => o.name.toLowerCase()));
    const toAdd: SizeQuantityOption[] = [];

    all.forEach((sz) => {
      if (!currentNames.has(sz.toLowerCase())) {
        toAdd.push({
          id: `opt_${Date.now()}_${sz}`,
          name: sz,
          sku: productSku ? `${productSku}-${sz}` : sz,
          stock: 15
        });
      }
    });

    if (toAdd.length > 0) {
      onChange([...options, ...toAdd]);
    }
  };

  // Pre-select popular shoe sizes (40-43)
  const handlePreselectPopularShoeSizes = () => {
    const popular = ['40', '41', '42', '43'];
    const currentNames = new Set(options.map((o) => o.name.toLowerCase()));
    const toAdd: SizeQuantityOption[] = [];

    popular.forEach((sz) => {
      if (!currentNames.has(sz.toLowerCase())) {
        toAdd.push({
          id: `opt_${Date.now()}_${sz}`,
          name: sz,
          sku: productSku ? `${productSku}-${sz}` : sz,
          stock: 15
        });
      }
    });

    if (toAdd.length > 0) {
      onChange([...options, ...toAdd]);
    }
  };

  // Pre-select all shoe sizes (38-45)
  const handlePreselectAllShoeSizes = () => {
    const all = ['38', '39', '40', '41', '42', '43', '44', '45'];
    const currentNames = new Set(options.map((o) => o.name.toLowerCase()));
    const toAdd: SizeQuantityOption[] = [];

    all.forEach((sz) => {
      if (!currentNames.has(sz.toLowerCase())) {
        toAdd.push({
          id: `opt_${Date.now()}_${sz}`,
          name: sz,
          sku: productSku ? `${productSku}-${sz}` : sz,
          stock: 15
        });
      }
    });

    if (toAdd.length > 0) {
      onChange([...options, ...toAdd]);
    }
  };

  // Pre-select popular toy/car scale sizes (1:24, 1:32, 1:64)
  const handlePreselectPopularToyScales = () => {
    const popular = ['1:24 Scale', '1:32 Scale', '1:64 Scale'];
    const currentNames = new Set(options.map((o) => o.name.toLowerCase()));
    const toAdd: SizeQuantityOption[] = [];

    popular.forEach((sz) => {
      if (!currentNames.has(sz.toLowerCase())) {
        const cleanSku = sz.replace(/[^a-zA-Z0-9]/g, '');
        toAdd.push({
          id: `opt_${Date.now()}_${cleanSku}`,
          name: sz,
          sku: productSku ? `${productSku}-${cleanSku}` : cleanSku,
          stock: 15
        });
      }
    });

    if (toAdd.length > 0) {
      onChange([...options, ...toAdd]);
    }
  };

  // Pre-select all toy/car scales & sizes
  const handlePreselectAllToyScales = () => {
    const all = ['1:18 Scale', '1:24 Scale', '1:32 Scale', '1:43 Scale', '1:64 Scale', 'Small', 'Medium', 'Large'];
    const currentNames = new Set(options.map((o) => o.name.toLowerCase()));
    const toAdd: SizeQuantityOption[] = [];

    all.forEach((sz) => {
      if (!currentNames.has(sz.toLowerCase())) {
        const cleanSku = sz.replace(/[^a-zA-Z0-9]/g, '');
        toAdd.push({
          id: `opt_${Date.now()}_${cleanSku}`,
          name: sz,
          sku: productSku ? `${productSku}-${cleanSku}` : cleanSku,
          stock: 15
        });
      }
    });

    if (toAdd.length > 0) {
      onChange([...options, ...toAdd]);
    }
  };

  // Pre-select popular dimensions (Small, Medium, Large)
  const handlePreselectPopularDimensions = () => {
    const popular = ['Small', 'Medium', 'Large'];
    const currentNames = new Set(options.map((o) => o.name.toLowerCase()));
    const toAdd: SizeQuantityOption[] = [];

    popular.forEach((sz) => {
      if (!currentNames.has(sz.toLowerCase())) {
        toAdd.push({
          id: `opt_${Date.now()}_${sz}`,
          name: sz,
          sku: productSku ? `${productSku}-${sz}` : sz,
          stock: 15
        });
      }
    });

    if (toAdd.length > 0) {
      onChange([...options, ...toAdd]);
    }
  };

  // Custom Add handler
  const handleCustomAdd = (e?: React.SyntheticEvent) => {
    if (e && 'preventDefault' in e) e.preventDefault();
    if (!customValue.trim()) return;

    const finalLabel = buildOptionString(customValue, customUnit);
    handleAddOption(finalLabel);
    setCustomValue('');
  };

  // Remove single option
  const handleRemoveOption = (id: string) => {
    onChange(options.filter((opt) => opt.id !== id));
  };

  // Update option fields
  const handleUpdateOption = (id: string, updates: Partial<SizeQuantityOption>) => {
    onChange(
      options.map((opt) => (opt.id === id ? { ...opt, ...updates } : opt))
    );
  };

  // Bulk Apply Stock to All
  const handleApplyBulkStock = () => {
    const num = Number(bulkStockVal);
    if (isNaN(num) || num < 0) return;
    onChange(options.map((opt) => ({ ...opt, stock: num })));
  };

  // Bulk Apply Price to All
  const handleApplyBulkPrice = () => {
    const num = Number(bulkPriceVal);
    if (isNaN(num) || num < 0) return;
    onChange(options.map((opt) => ({ ...opt, price: num > 0 ? num : undefined })));
  };

  // Clear all
  const handleClearAll = () => {
    if (window.confirm('আপনি কি সত্যিই সকল সাইজ/পরিমাণের অপশন মুছে ফেলতে চান?')) {
      onChange([]);
    }
  };

  // Total stock calculation
  const totalCalculatedStock = options.reduce((sum, opt) => sum + (Number(opt.stock) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header with Title and Auto-Detection Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#EFEBE5] gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[#1A1E1C] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#1E3A2F]" />
              <span>Smart Size & Quantity Suggestion System</span>
            </h3>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              <span>Smart Catalog</span>
            </span>
          </div>
          <p className="text-xs text-[#626C66] mt-1">
            Category ও Product Type অনুযায়ী সাইজ, ওজন, আয়তন বা প্যাকেটের পরিমাণের স্বয়ংক্রিয় সাজেশন।
          </p>
        </div>

        {/* Display title override */}
        {onOptionTitleChange && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-stone-600 whitespace-nowrap">
              Option Label:
            </label>
            <input
              type="text"
              value={optionTitle || ''}
              onChange={(e) => onOptionTitleChange(e.target.value)}
              placeholder="e.g. Size, Volume, Weight, Pack"
              className="px-2.5 py-1 text-xs bg-white border border-[#E5DFD7] rounded-lg font-medium text-stone-800 w-36 focus:outline-hidden focus:border-[#1E3A2F]"
            />
          </div>
        )}
      </div>

      {/* Preset Category Switcher Bar */}
      <div>
        <label className="text-[11px] font-bold text-[#626C66] uppercase tracking-wider block mb-2">
          Select Category Presets (সাজেশন ক্যাটাগরি বেছে নিন):
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2.5">
          {PRESET_GROUPS.map((group) => {
            const isActive =
              activePreset === group.id ||
              (activePreset === 'fashion_clothing' && group.id === 'standard_sizes');
            const isAutoDetected =
              detectedPreset === group.id ||
              (detectedPreset === 'fashion_clothing' && group.id === 'standard_sizes');

            return (
              <button
                type="button"
                key={group.id}
                onClick={() => setActivePreset(group.id)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                  isActive
                    ? 'border-[#1E3A2F] bg-white ring-2 ring-[#1E3A2F] shadow-xs'
                    : 'border-[#E5DFD7] bg-[#FAF8F5] hover:bg-white hover:border-stone-400'
                }`}
              >
                {isAutoDetected && (
                  <span className="absolute -top-2 right-2 px-1.5 py-0.2 bg-[#1E3A2F] text-white text-[9px] font-bold rounded-full shadow-2xs">
                    Auto
                  </span>
                )}
                <div className="flex items-center gap-2 mb-1">
                  {group.icon}
                  <span className="text-xs font-bold text-[#1A1E1C] truncate">{group.titleEn}</span>
                </div>
                <span className="text-[10px] text-[#626C66] line-clamp-1">{group.titleBn}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Options Cloud (এখন পর্যন্ত যোগকৃত সাইজ ও পরিমাণের তালিকা) */}
      {options.length > 0 && (
        <div className="p-3.5 bg-white border border-[#E5DFD7] rounded-2xl shadow-xs space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-xs font-bold text-[#1A1E1C] flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>যোগকৃত সাইজ ও পরিমাণসমূহ ({options.length} টি ভ্যারিয়েন্ট):</span>
            </span>
            <span className="text-[11px] text-stone-500">
              মোট স্টক: <strong className="text-[#1E3A2F] font-bold">{totalCalculatedStock} pcs</strong>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {options.map((opt) => (
              <span
                key={opt.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1E3A2F] text-white rounded-xl text-xs font-bold shadow-2xs group"
              >
                {opt.colorCode && (
                  <span
                    className="w-3 h-3 rounded-full border border-white/60 shrink-0 shadow-2xs"
                    style={{ backgroundColor: opt.colorCode }}
                    title={opt.colorName || opt.colorCode}
                  />
                )}
                <span>{opt.name}</span>
                {opt.colorName && (
                  <span className="text-[10px] text-amber-200 font-medium max-w-[120px] truncate">
                    ({opt.colorName.split('(')[0].trim()})
                  </span>
                )}
                <span className="text-[10px] text-emerald-300 font-mono">({opt.stock} pcs)</span>
                <button
                  type="button"
                  onClick={() => handleRemoveOption(opt.id)}
                  className="text-stone-300 hover:text-rose-300 p-0.5 rounded cursor-pointer transition-colors"
                  title={`Remove ${opt.name}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Suggestion Chips Section */}
      <div className="bg-[#FAF8F5] border border-[#E5DFD7] rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold text-[#1A1E1C] flex items-center gap-1.5">
              <span>{currentGroup.titleBn} ({currentGroup.titleEn}) সাজেশন্স:</span>
            </h4>
            <p className="text-[11px] text-[#626C66]">
              নিচের সাজেশনে ক্লিক করলেই সেটি তাৎক্ষণিকভাবে পণ্যের সঙ্গে যুক্ত হবে। পুনরায় ক্লিক করলে বাদ যাবে।
            </p>
          </div>

          {/* Quick preset buttons depending on category */}
          {(activePreset === 'standard_sizes' || activePreset === 'fashion_clothing') && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={handlePreselectPopularClothing}
                className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-900 rounded-lg text-[11px] font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                title="জনপ্রিয় M, L, XL সাইজ একসাথে সিলেক্ট করুন"
              >
                <Ruler className="w-3 h-3 text-indigo-600" />
                <span>জনপ্রিয় সাইজ (M, L, XL)</span>
              </button>
              <button
                type="button"
                onClick={handlePreselectAllClothing}
                className="px-2 py-1 bg-white border border-stone-200 hover:border-stone-400 text-stone-700 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
                title="XS থেকে XXL সব সাইজ যোগ করুন"
              >
                + সব সাইজ
              </button>
            </div>
          )}

          {activePreset === 'toys_cars' && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={handlePreselectPopularToyScales}
                className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-900 rounded-lg text-[11px] font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                title="জনপ্রিয় স্কেল (1:24, 1:32, 1:64) একসাথে যোগ করুন"
              >
                <Car className="w-3 h-3 text-emerald-600" />
                <span>জনপ্রিয় স্কেল (1:24, 1:32, 1:64)</span>
              </button>
              <button
                type="button"
                onClick={handlePreselectAllToyScales}
                className="px-2 py-1 bg-white border border-stone-200 hover:border-stone-400 text-stone-700 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
                title="সব স্কেল ও সাইজ একসাথে যোগ করুন"
              >
                + সব স্কেল ও সাইজ
              </button>
            </div>
          )}

          {activePreset === 'footwear' && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={handlePreselectPopularShoeSizes}
                className="px-2.5 py-1 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-900 rounded-lg text-[11px] font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                title="জনপ্রিয় জুতার সাইজ (৪০, ৪১, ৪২, ৪৩) একসাথে যোগ করুন"
              >
                <Boxes className="w-3 h-3 text-rose-600" />
                <span>জনপ্রিয় জুতার সাইজ (৪০-৪৩)</span>
              </button>
              <button
                type="button"
                onClick={handlePreselectAllShoeSizes}
                className="px-2 py-1 bg-white border border-stone-200 hover:border-stone-400 text-stone-700 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
                title="৩৯ থেকে ৪৫ সব জুতার সাইজ যোগ করুন"
              >
                + সব জুতার সাইজ (৩৯-৪৫)
              </button>
            </div>
          )}

          {activePreset === 'dimensions' && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={handlePreselectPopularDimensions}
                className="px-2.5 py-1 bg-teal-50 border border-teal-200 hover:bg-teal-100 text-teal-900 rounded-lg text-[11px] font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                title="Small, Medium, Large সাইজ একসাথে যোগ করুন"
              >
                <Layers className="w-3 h-3 text-teal-600" />
                <span>জনপ্রিয় সাইজ (S, M, L)</span>
              </button>
            </div>
          )}
        </div>

        {/* Standard Suggestions Chips */}
        <div>
          <span className="text-[10px] font-bold text-[#626C66] uppercase tracking-wider block mb-1.5">
            Standard Options (জনপ্রিয় মাপ ও পরিমাণ — ক্লিক করে যোগ বা বাতিল করুন):
          </span>
          <div className="flex flex-wrap gap-2">
            {currentGroup.standardSuggestions.map((sug) => {
              const isAdded = options.some(
                (opt) => opt.name.toLowerCase() === sug.toLowerCase()
              );

              return (
                <button
                  type="button"
                  key={sug}
                  onClick={() => handleToggleOption(sug)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                    isAdded
                      ? 'border-[#1E3A2F] bg-[#1E3A2F] text-white hover:bg-[#162B23]'
                      : 'border-[#E5DFD7] bg-white text-[#1A1E1C] hover:border-[#1E3A2F] hover:bg-emerald-50/50'
                  }`}
                  title={isAdded ? `Click to remove "${sug}"` : `Click to add "${sug}"`}
                >
                  {isAdded ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Plus className="w-3.5 h-3.5 text-stone-400" />}
                  <span>{sug}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Extra Quick Suggestions Chips */}
        {currentGroup.extraSuggestions.length > 0 && (
          <div className="pt-2 border-t border-[#EFEBE5]">
            <span className="text-[10px] font-bold text-[#626C66] uppercase tracking-wider block mb-1.5">
              Extended & Large Pack Options (অতিরিক্ত বিকল্পসমূহ):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {currentGroup.extraSuggestions.map((sug) => {
                const isAdded = options.some(
                  (opt) => opt.name.toLowerCase() === sug.toLowerCase()
                );

                return (
                  <button
                    type="button"
                    key={sug}
                    onClick={() => handleToggleOption(sug)}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                      isAdded
                        ? 'border-emerald-700 bg-emerald-800 text-white'
                        : 'border-[#E5DFD7] bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-50'
                    }`}
                    title={isAdded ? `Click to remove "${sug}"` : `Click to add "${sug}"`}
                  >
                    {isAdded ? <Check className="w-3 h-3 text-emerald-300" /> : <Plus className="w-3 h-3 text-stone-400" />}
                    <span>{sug}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Custom Value & Unit Input Builder */}
        <div className="pt-3 border-t border-[#EFEBE5] space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-[11px] font-bold text-[#1A1E1C]">
              Custom Quantity / Size Builder (নিজের ইচ্ছামতো সংখ্যা ও একক লিখুন):
            </span>
            <span className="text-[10px] text-stone-500">
              সংখ্যা লিখে নিচের যেকোনো ইউনিটে সরাসরি ক্লিক করলেই যোগ হয়ে যাবে
            </span>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            {/* Number / Value input */}
            <div className="w-full sm:w-52">
              <input
                type="text"
                placeholder="সংখ্যা লিখুন (e.g. 330, 600, 750, 5, 42)"
                value={customValue}
                onChange={(e) => {
                  setCustomValue(e.target.value);
                  setDuplicateWarning(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCustomAdd();
                  }
                }}
                className="w-full px-3 py-2 bg-white border border-[#E5DFD7] rounded-xl text-xs font-semibold text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
              />
            </div>

            {/* Unit Dropdown / Selector */}
            <div className="w-full sm:w-40">
              <select
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#E5DFD7] rounded-xl text-xs font-semibold text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F] cursor-pointer"
              >
                {currentGroup.commonUnits.map((u) => (
                  <option key={u} value={u === 'None' ? '' : u}>
                    {u === 'None' ? 'No Unit (Only Size)' : u}
                  </option>
                ))}
                <option value="ml">ml (Milliliter)</option>
                <option value="L">L (Liter)</option>
                <option value="g">g (Gram)</option>
                <option value="kg">kg (Kilogram)</option>
                <option value="Piece">Piece (পিস)</option>
                <option value="Pieces">Pieces</option>
                <option value="Pack">Pack (প্যাক)</option>
                <option value="Box">Box (বক্স)</option>
                <option value="Pair">Pair (জোড়া)</option>
                <option value="Dozen">Dozen (ডজন)</option>
              </select>
            </div>

            {/* Quick Preview Badge */}
            <div className="hidden md:flex items-center px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs text-stone-500 whitespace-nowrap min-w-28">
              Preview:{' '}
              <strong className="text-[#1E3A2F] ml-1.5 font-bold">
                {customValue.trim() ? buildOptionString(customValue, customUnit) : '—'}
              </strong>
            </div>

            {/* Add Button */}
            <button
              type="button"
              onClick={() => handleCustomAdd()}
              disabled={!customValue.trim()}
              className="w-full sm:w-auto px-5 py-2 bg-[#1E3A2F] hover:bg-[#162B23] disabled:bg-stone-300 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              <span>যোগ করুন (Add)</span>
            </button>
          </div>

          {/* Quick Direct-Unit Click Buttons: সংখ্যা লিখে একক বাটনে চাপলেই সরাসরি যোগ হবে */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-bold text-stone-600 flex items-center gap-1 shrink-0">
              ⚡ সংখ্যা লিখে এক ক্লিকে যোগ করুন:
            </span>
            {currentGroup.commonUnits.filter(u => u !== 'None').map((u) => (
              <button
                type="button"
                key={u}
                onClick={() => handleQuickAddUnit(u)}
                className="px-2.5 py-1 bg-white hover:bg-[#1E3A2F] hover:text-white border border-stone-300 hover:border-[#1E3A2F] rounded-lg text-xs font-bold text-stone-700 transition-all cursor-pointer shadow-2xs flex items-center gap-1 group"
                title={`Click to add "${customValue.trim() || '1'} ${u}"`}
              >
                <Plus className="w-3 h-3 text-emerald-600 group-hover:text-white" />
                <span>{customValue.trim() ? `${customValue.trim()} ${u}` : `+ ${u}`}</span>
              </button>
            ))}
          </div>

          {/* Duplicate warning notification */}
          {duplicateWarning && (
            <div className="mt-2.5 p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-900 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{duplicateWarning}</span>
            </div>
          )}
        </div>
      </div>


      {/* Configured Options List & Individual Management Table */}
      {options.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
            <div>
              <h4 className="text-xs font-bold text-[#1A1E1C] uppercase tracking-wider flex items-center gap-2">
                <span>Configured Options Matrix ({options.length} Options)</span>
                <span className="text-[11px] font-normal text-[#626C66] lowercase">
                  (প্রতিটি মাপের আলাদা স্টক ও মূল্য)
                </span>
              </h4>
            </div>

            {/* Bulk Toolbar */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Batch / Multi-Color Button */}
              <button
                type="button"
                onClick={() => handleOpenColorModal('multi_add')}
                className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer group"
                title="একসাথে অনেকগুলো রঙ নির্বাচন বা কোড দিয়ে যোগ করুন"
              >
                <ListPlus className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                <span>+ একসাথে অনেক রঙ যোগ (Add Multiple Colors)</span>
              </button>

              {/* Bulk Color Button for All existing */}
              <button
                type="button"
                onClick={() => handleOpenColorModal('all')}
                className="px-2.5 py-1.5 bg-white border border-[#E5DFD7] hover:border-[#1E3A2F] text-[#1A1E1C] hover:text-[#1E3A2F] rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer group"
                title="বর্তমান সকল অপশনে একটি নির্দিষ্ট রঙ নির্ধারণ করুন"
              >
                <Palette className="w-3.5 h-3.5 text-purple-600 group-hover:scale-110 transition-transform" />
                <span>সকল অপশনে এক রঙ (Same Color for All)</span>
              </button>

              <div className="flex items-center gap-1 bg-[#FAF8F5] border border-[#E5DFD7] rounded-lg p-1">
                <span className="text-[10px] font-semibold text-stone-500 px-1">Stock for All:</span>
                <input
                  type="number"
                  min="0"
                  value={bulkStockVal}
                  onChange={(e) => setBulkStockVal(e.target.value)}
                  className="w-14 px-1.5 py-0.5 bg-white border border-[#E5DFD7] rounded text-xs font-bold text-center"
                />
                <button
                  type="button"
                  onClick={handleApplyBulkStock}
                  className="px-2 py-0.5 bg-[#1E3A2F] text-white rounded text-[10px] font-bold hover:bg-[#162B23]"
                >
                  Apply
                </button>
              </div>

              <div className="flex items-center gap-1 bg-[#FAF8F5] border border-[#E5DFD7] rounded-lg p-1">
                <span className="text-[10px] font-semibold text-stone-500 px-1">Price for All:</span>
                <input
                  type="number"
                  min="0"
                  placeholder={`৳${basePrice}`}
                  value={bulkPriceVal}
                  onChange={(e) => setBulkPriceVal(e.target.value)}
                  className="w-16 px-1.5 py-0.5 bg-white border border-[#E5DFD7] rounded text-xs text-center"
                />
                <button
                  type="button"
                  onClick={handleApplyBulkPrice}
                  className="px-2 py-0.5 bg-[#1E3A2F] text-white rounded text-[10px] font-bold hover:bg-[#162B23]"
                >
                  Apply
                </button>
              </div>

              <button
                type="button"
                onClick={handleClearAll}
                className="px-2.5 py-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg text-xs font-semibold cursor-pointer border border-transparent hover:border-red-200 transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Options Table */}
          <div className="border border-[#E5DFD7] rounded-2xl overflow-hidden bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F5] text-[#626C66] border-b border-[#E5DFD7] text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="p-3 font-bold">Size / Quantity Option</th>
                    <th className="p-3 font-bold">Color (রঙ ও কোড)</th>
                    <th className="p-3 font-bold">Custom SKU</th>
                    <th className="p-3 font-bold">Stock Quantity</th>
                    <th className="p-3 font-bold">Price Override (৳)</th>
                    <th className="p-3 font-bold">Status</th>
                    <th className="p-3 font-bold text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFEBE5]">
                  {options.map((opt) => {
                    const isOut = opt.stock <= 0;
                    const isLow = opt.stock > 0 && opt.stock <= 5;
                    const effectivePrice = opt.price && opt.price > 0 ? opt.price : basePrice;

                    return (
                      <tr key={opt.id} className="hover:bg-stone-50/60 transition-colors">
                        {/* Option Label */}
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2.5 py-1 bg-[#1E3A2F] text-white font-bold rounded-lg text-xs shadow-2xs">
                              {opt.name}
                            </span>
                          </div>
                        </td>

                        {/* Color Selector Cell */}
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenColorModal(opt.id, opt.colorCode, opt.colorName)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all cursor-pointer ${
                                opt.colorCode
                                  ? 'border-[#E5DFD7] bg-white hover:border-[#1E3A2F] text-[#1A1E1C]'
                                  : 'border-dashed border-stone-300 hover:border-[#1E3A2F] bg-stone-50 text-stone-600 hover:bg-white'
                              }`}
                              title={opt.colorName ? `${opt.colorName} (${opt.colorCode}) - ক্লিক করে পরিবর্তন করুন` : 'রঙ নির্বাচন করুন'}
                            >
                              {opt.colorCode ? (
                                <>
                                  <span
                                    className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0 shadow-2xs"
                                    style={{ backgroundColor: opt.colorCode }}
                                  />
                                  <div className="flex flex-col text-left">
                                    <span className="font-bold text-[11px] leading-tight max-w-[130px] truncate text-[#1A1E1C]">
                                      {opt.colorName || opt.colorCode}
                                    </span>
                                    <span className="text-[9px] font-mono text-stone-400 leading-none">
                                      {opt.colorCode}
                                    </span>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <Palette className="w-3.5 h-3.5 text-stone-400" />
                                  <span className="text-[11px] font-medium text-stone-500">+ রঙ বেছে নিন</span>
                                </>
                              )}
                            </button>
                            {opt.colorCode && (
                              <button
                                type="button"
                                onClick={() => handleClearColor(opt.id)}
                                className="p-1 text-stone-400 hover:text-rose-500 rounded cursor-pointer transition-colors"
                                title="রঙ মুছে ফেলুন"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* SKU */}
                        <td className="p-3">
                          <input
                            type="text"
                            value={opt.sku || ''}
                            onChange={(e) => handleUpdateOption(opt.id, { sku: e.target.value })}
                            placeholder="e.g. SKU-SIZE"
                            className="w-32 px-2.5 py-1.5 bg-[#FAF8F5] border border-[#E5DFD7] rounded-lg text-xs font-mono text-[#1A1E1C] focus:bg-white focus:outline-hidden focus:border-[#1E3A2F]"
                          />
                        </td>

                        {/* Stock */}
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              value={opt.stock}
                              onChange={(e) =>
                                handleUpdateOption(opt.id, {
                                  stock: Math.max(0, parseInt(e.target.value) || 0)
                                })
                              }
                              className="w-24 px-2.5 py-1.5 bg-white border border-[#E5DFD7] rounded-lg text-xs font-bold text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                            />
                            <span className="text-stone-400 text-[11px]">pcs</span>
                          </div>
                        </td>

                        {/* Price Override */}
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-stone-400 font-bold">৳</span>
                            <input
                              type="number"
                              min="0"
                              value={opt.price ?? ''}
                              onChange={(e) =>
                                handleUpdateOption(opt.id, {
                                  price: e.target.value ? Math.max(0, parseFloat(e.target.value)) : undefined
                                })
                              }
                              placeholder={`Default (৳${basePrice})`}
                              className="w-32 px-2.5 py-1.5 bg-white border border-[#E5DFD7] rounded-lg text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                            />
                            {opt.price && opt.price !== basePrice && (
                              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                                Custom
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              isOut
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : isLow
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isOut ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                            />
                            {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                          </span>
                        </td>

                        {/* Remove */}
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(opt.id)}
                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title={`Remove ${opt.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Footer with Summary */}
            <div className="bg-[#FAF8F5] px-4 py-3 border-t border-[#E5DFD7] flex flex-col sm:flex-row sm:items-center justify-between text-xs text-[#626C66] gap-2">
              <div className="flex items-center gap-4">
                <span>
                  Total Options: <strong className="text-[#1A1E1C]">{options.length}</strong>
                </span>
                <span>
                  Total Stock Calculated:{' '}
                  <strong className="text-[#1E3A2F] font-bold">{totalCalculatedStock} Units</strong>
                </span>
              </div>
              <span className="text-[11px] text-stone-500">
                Customer Storefront-এ প্রতিটি অপশনের নির্ধারিত স্টক ও মূল্য সঠিকভাবে কার্যকর হবে।
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 border-2 border-dashed border-[#E5DFD7] rounded-2xl text-center bg-[#FAF8F5] space-y-2">
          <Info className="w-6 h-6 text-stone-400 mx-auto" />
          <h5 className="text-xs font-bold text-stone-700">কোনো Size বা Quantity Option যোগ করা হয়নি</h5>
          <p className="text-[11px] text-stone-500 max-w-md mx-auto">
            উপরের সাজেশনে ক্লিক করে অথবা Custom Value & Unit লিখে সহজে মাপ ও পরিমাণ যোগ করুন।
            যদি কোনো অপশন না রাখেন, পণ্যটি সিঙ্গেল আইটেম হিসেবে বিক্রি হবে।
          </p>
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={() => handleOpenColorModal('multi_add')}
              className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <ListPlus className="w-4 h-4" />
              <span>একসাথে অনেক রঙের ভ্যারিয়েন্ট যোগ করুন (Add Multiple Colors)</span>
            </button>
          </div>
        </div>
      )}

      {/* Color Selection Modal (Single Color Picker OR Multi-Color Batch Generator) */}
      {colorModalTargetId !== null && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-[#FAF8F5]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center text-purple-700 shadow-2xs">
                  {colorModalTargetId === 'multi_add' ? (
                    <ListPlus className="w-5 h-5 text-purple-700" />
                  ) : (
                    <Palette className="w-5 h-5 text-purple-700" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#1A1E1C]">
                    {colorModalTargetId === 'multi_add'
                      ? 'একসাথে অনেক রঙ যোগ করুন (Add Multiple Colors)'
                      : colorModalTargetId === 'all'
                      ? 'সকল অপশনের জন্য রঙ নির্বাচন'
                      : `রঙ নির্বাচন (${options.find((o) => o.id === colorModalTargetId)?.name || 'অপশন'})`}
                  </h4>
                  <p className="text-[11px] text-[#626C66]">
                    {colorModalTargetId === 'multi_add'
                      ? 'একাধিক রঙ বেছে নিন বা একসাথে হেক্স কোড লিখে যুক্ত করুন'
                      : '১২টি স্ট্যান্ডার্ড রঙ অথবা যেকোনো কালার কোড লিখুন'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setColorModalTargetId(null)}
                className="w-7 h-7 rounded-full hover:bg-stone-200 text-stone-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {colorModalTargetId === 'multi_add' ? (
                /* ================= MULTI-COLOR BATCH MODE ================= */
                <div className="space-y-4">
                  {/* Selected Multi Colors Cloud */}
                  <div className="p-3.5 bg-purple-50/50 border border-purple-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                        <CheckSquare className="w-4 h-4 text-purple-600" />
                        <span>নির্বাচিত রঙের তালিকা ({selectedMultiColors.length} টি রঙ):</span>
                      </span>
                      {selectedMultiColors.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearAllMultiColors}
                          className="text-[10px] text-rose-600 hover:underline font-bold cursor-pointer"
                        >
                          সব মুছুন (Clear All)
                        </button>
                      )}
                    </div>

                    {selectedMultiColors.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedMultiColors.map((col) => (
                          <span
                            key={col.hex}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-purple-300 rounded-lg text-xs font-bold text-stone-800 shadow-2xs"
                          >
                            <span
                              className="w-3 h-3 rounded-full border border-black/20 shrink-0 shadow-2xs"
                              style={{ backgroundColor: col.hex }}
                            />
                            <span>{col.nameBn}</span>
                            <span className="text-[9px] font-mono text-stone-400 font-normal">
                              ({col.nameEn})
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleMultiColor(col)}
                              className="text-stone-400 hover:text-rose-500 p-0.5 rounded cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-stone-500 italic py-1">
                        নিচে থেকে ক্লিক করে একাধিক রঙ বেছে নিন অথবা কোড লিখে যোগ করুন।
                      </div>
                    )}
                  </div>

                  {/* 12 Standard Colors Multi-Selection Grid */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[11px] font-bold text-[#1A1E1C] uppercase tracking-wider">
                        ১. স্ট্যান্ডার্ড ১২টি রঙ (ক্লিক করে নির্বাচন করুন):
                      </label>
                      <button
                        type="button"
                        onClick={handleSelectAll12MultiColors}
                        className="text-[11px] font-bold text-[#1E3A2F] hover:underline cursor-pointer"
                      >
                        + ১২টি রঙই সিলেক্ট করুন
                      </button>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {DEFAULT_12_COLORS.map((col) => {
                        const isSelected = selectedMultiColors.some(
                          (c) => c.hex.toLowerCase() === col.hex.toLowerCase()
                        );
                        return (
                          <button
                            type="button"
                            key={col.hex}
                            onClick={() =>
                              handleToggleMultiColor({
                                hex: col.hex,
                                nameBn: col.nameBn,
                                nameEn: col.nameEn
                              })
                            }
                            className={`p-2 rounded-xl border flex items-center gap-2 text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'border-[#1E3A2F] bg-emerald-50/60 ring-2 ring-[#1E3A2F] shadow-xs'
                                : 'border-stone-200 hover:border-stone-400 bg-white hover:bg-stone-50'
                            }`}
                          >
                            <span
                              className="w-5 h-5 rounded-full border border-black/20 shadow-2xs shrink-0 relative flex items-center justify-center"
                              style={{ backgroundColor: col.hex }}
                            >
                              {isSelected && (
                                <Check className="w-3 h-3 text-white mix-blend-difference stroke-[3]" />
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <span className="text-[11px] font-bold text-[#1A1E1C] leading-none block truncate">
                                {col.nameBn}
                              </span>
                              <span className="text-[9px] text-stone-500 leading-none truncate block">
                                {col.nameEn}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Single Custom Hex Input + Add */}
                  <div className="pt-3 border-t border-stone-200 space-y-2">
                    <label className="text-[11px] font-bold text-[#1A1E1C] uppercase tracking-wider block">
                      ২. কালার পিকার বা একটি কোড দিয়ে যোগ করুন:
                    </label>
                    <div className="flex items-center gap-2">
                      {/* HTML5 Native Color Picker Wheel */}
                      <div className="relative w-10 h-10 shrink-0">
                        <input
                          type="color"
                          value={activeColorHex}
                          onChange={(e) => handleCustomHexChange(e.target.value)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          title="কালার পিকার খুলুন"
                        />
                        <div
                          className="w-full h-full rounded-xl border border-stone-300 shadow-xs flex items-center justify-center cursor-pointer pointer-events-none"
                          style={{ backgroundColor: activeColorHex }}
                        >
                          <Palette className="w-4 h-4 mix-blend-difference text-white" />
                        </div>
                      </div>

                      {/* Hex Text Input */}
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-2.5 text-stone-400 font-mono font-bold text-xs">
                          #
                        </span>
                        <input
                          type="text"
                          maxLength={7}
                          placeholder="e.g. FF5733"
                          value={customHexInput.replace(/^#/, '')}
                          onChange={(e) => handleCustomHexChange(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCustomToMultiList(customHexInput);
                            }
                          }}
                          className="w-full pl-7 pr-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono font-bold text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddCustomToMultiList(customHexInput || activeColorHex)}
                        className="px-3 py-2 bg-[#1E3A2F] text-white rounded-xl text-xs font-bold hover:bg-[#162B23] cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>রঙে যোগ করুন</span>
                      </button>
                    </div>

                    {customHexInput && isValidHex(customHexInput) && (
                      <div className="text-[11px] text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 font-semibold flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        <span>শনাক্তকৃত নাম: <strong>{activeColorName}</strong></span>
                      </div>
                    )}
                  </div>

                  {/* Batch Hex Codes Textarea (কমা বা নতুন লাইন দিয়ে অনেক কোড) */}
                  <div className="pt-3 border-t border-stone-200 space-y-1.5">
                    <label className="text-[11px] font-bold text-[#1A1E1C] uppercase tracking-wider block">
                      ৩. একসাথে অনেক রঙের হেক্স কোড লিখুন (Batch Hex Codes):
                    </label>
                    <p className="text-[10px] text-stone-500">
                      কমা, স্পেস বা নতুন লাইন দিয়ে একাধিক কোড লিখুন (যেমন: <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-700">#FF5733, #3B82F6, #10B981, #FF1493</code>)। প্রতিটি রঙের নাম স্বয়ংক্রিয়ভাবে বের হয়ে যুক্ত হবে!
                    </p>
                    <div className="flex gap-2">
                      <textarea
                        rows={2}
                        value={batchHexTextInput}
                        onChange={(e) => setBatchHexTextInput(e.target.value)}
                        placeholder="#FF5733, #3B82F6, #10B981, #FF1493, #FACC15..."
                        className="flex-1 p-2 bg-white border border-stone-300 rounded-xl text-xs font-mono text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                      />
                      <button
                        type="button"
                        onClick={handleParseBatchHexText}
                        disabled={!batchHexTextInput.trim()}
                        className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 disabled:bg-stone-300 text-white rounded-xl text-xs font-bold cursor-pointer disabled:cursor-not-allowed shrink-0 self-end transition-all"
                      >
                        কোডগুলো যোগ করুন
                      </button>
                    </div>
                  </div>

                  {/* Mode Selector for Multi-Color Apply */}
                  <div className="pt-3 border-t border-stone-200">
                    <span className="text-[11px] font-bold text-[#1A1E1C] uppercase tracking-wider block mb-1.5">
                      কীভাবে যোগ করতে চান (Action Mode):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <label
                        className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                          multiColorMode === 'create_options'
                            ? 'border-[#1E3A2F] bg-emerald-50/40 ring-1 ring-[#1E3A2F]'
                            : 'border-stone-200 bg-white hover:border-stone-400'
                        }`}
                      >
                        <input
                          type="radio"
                          name="multiColorMode"
                          checked={multiColorMode === 'create_options'}
                          onChange={() => setMultiColorMode('create_options')}
                          className="hidden"
                        />
                        <span className="font-bold text-[#1A1E1C] block">
                          নতুন রঙের ভ্যারিয়েন্ট যোগ করুন
                        </span>
                        <span className="text-[10px] text-stone-500 block mt-0.5">
                          প্রতিটি রঙের জন্য আলাদা অপশন তৈরি হবে
                        </span>
                      </label>

                      <label
                        className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                          multiColorMode === 'apply_existing'
                            ? 'border-[#1E3A2F] bg-emerald-50/40 ring-1 ring-[#1E3A2F]'
                            : 'border-stone-200 bg-white hover:border-stone-400'
                        }`}
                      >
                        <input
                          type="radio"
                          name="multiColorMode"
                          checked={multiColorMode === 'apply_existing'}
                          onChange={() => setMultiColorMode('apply_existing')}
                          className="hidden"
                        />
                        <span className="font-bold text-[#1A1E1C] block">
                          বিদ্যমান অপশনগুলোতে রঙ বসান
                        </span>
                        <span className="text-[10px] text-stone-500 block mt-0.5">
                          বর্তমান অপশনগুলোতে পর্যায়ক্রমে রঙ বণ্টন হবে
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                /* ================= SINGLE COLOR SELECTION MODE ================= */
                <div className="space-y-4">
                  {/* Selected Color Live Preview & Auto-Naming Badge */}
                  <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 flex items-center gap-3.5 shadow-2xs">
                    <div
                      className="w-12 h-12 rounded-xl border-2 border-white shadow-md shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: activeColorHex }}
                    >
                      <span className="text-[9px] font-bold font-mono opacity-80 mix-blend-difference text-white">
                        {activeColorHex}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                          নির্ধারিত রঙের নাম (Auto Color Name):
                        </span>
                        <Sparkles className="w-3 h-3 text-amber-500" />
                      </div>
                      <div className="text-sm font-bold text-[#1A1E1C] truncate">
                        {activeColorName}
                      </div>
                      <div className="text-[11px] font-mono text-stone-500 font-semibold">
                        Hex: {activeColorHex}
                      </div>
                    </div>
                  </div>

                  {/* Standard 12 Preset Retail Colors */}
                  <div>
                    <label className="text-[11px] font-bold text-[#1A1E1C] uppercase tracking-wider block mb-2">
                      ১. স্ট্যান্ডার্ড ১২টি রিটেইল রঙ (12 Standard Retail Colors):
                    </label>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {DEFAULT_12_COLORS.map((col) => {
                        const isSelected =
                          activeColorHex.toLowerCase() === col.hex.toLowerCase();
                        return (
                          <button
                            type="button"
                            key={col.hex}
                            onClick={() => handleSelectPresetColor(col)}
                            className={`group relative p-2 rounded-xl border flex flex-col items-center text-center transition-all cursor-pointer ${
                              isSelected
                                ? 'border-[#1E3A2F] ring-2 ring-[#1E3A2F] bg-emerald-50/40 shadow-xs'
                                : 'border-stone-200 hover:border-stone-400 bg-white hover:bg-stone-50'
                            }`}
                            title={`${col.nameBn} (${col.nameEn}) - ${col.hex}`}
                          >
                            <span
                              className="w-7 h-7 rounded-full border border-black/20 shadow-2xs mb-1 group-hover:scale-105 transition-transform relative"
                              style={{ backgroundColor: col.hex }}
                            >
                              {isSelected && (
                                <span className="absolute inset-0 flex items-center justify-center text-white mix-blend-difference">
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] font-bold text-[#1A1E1C] leading-tight line-clamp-1">
                              {col.nameBn}
                            </span>
                            <span className="text-[9px] text-stone-500 leading-none truncate max-w-full">
                              {col.nameEn}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Hex Color Code & Native Picker */}
                  <div className="pt-3 border-t border-stone-200">
                    <label className="text-[11px] font-bold text-[#1A1E1C] uppercase tracking-wider block mb-1">
                      ২. কাস্টম কালার কোড বা পিকার (Custom Hex Code & Picker):
                    </label>
                    <p className="text-[11px] text-stone-500 mb-2.5">
                      যেকোনো রঙের হেক্স কোড লিখুন (যেমন: <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-700">#FF5733</code> বা <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-700">#3B82F6</code>)। স্বয়ংক্রিয়ভাবে রঙের নাম বের হয়ে যাবে!
                    </p>

                    <div className="flex items-center gap-2">
                      {/* HTML5 Native Color Picker Wheel */}
                      <div className="relative w-10 h-10 shrink-0">
                        <input
                          type="color"
                          value={activeColorHex}
                          onChange={(e) => handleCustomHexChange(e.target.value)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          title="কালার পিকার খুলুন"
                        />
                        <div
                          className="w-full h-full rounded-xl border border-stone-300 shadow-xs flex items-center justify-center cursor-pointer pointer-events-none"
                          style={{ backgroundColor: activeColorHex }}
                        >
                          <Palette className="w-4 h-4 mix-blend-difference text-white" />
                        </div>
                      </div>

                      {/* Hex Text Input */}
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-2.5 text-stone-400 font-mono font-bold text-xs">
                          #
                        </span>
                        <input
                          type="text"
                          maxLength={7}
                          placeholder="e.g. FF5733 or #3B82F6"
                          value={customHexInput.replace(/^#/, '')}
                          onChange={(e) => handleCustomHexChange(e.target.value)}
                          className="w-full pl-7 pr-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono font-bold text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F] focus:ring-1 focus:ring-[#1E3A2F]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-stone-50 border-t border-stone-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleClearColor(colorModalTargetId)}
                className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
              >
                রঙ বাতিল (Clear)
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setColorModalTargetId(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
                {colorModalTargetId === 'multi_add' ? (
                  <button
                    type="button"
                    onClick={handleApplyMultiColors}
                    disabled={selectedMultiColors.length === 0}
                    className="px-4 py-1.5 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 disabled:bg-stone-300 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>
                      {selectedMultiColors.length > 0
                        ? `${selectedMultiColors.length}টি রঙ যোগ করুন`
                        : 'রঙ নির্বাচন করুন'}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleApplyColor}
                    className="px-4 py-1.5 bg-[#1E3A2F] hover:bg-[#162B23] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>
                      {colorModalTargetId === 'all' ? 'সকল অপশনে প্রয়োগ করুন' : 'রঙ নিশ্চিত করুন'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
