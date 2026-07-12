"use client";

/**
 * CreateTopicForm — Client-side form for creating a new topic with options.
 * Requires authentication. Redirects to new topic on success.
 */
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface OptionField {
  name: string;
  description: string;
}

interface CreateTopicFormProps {
  categories: Category[];
}

interface FormErrors {
  title?: string;
  categoryId?: string;
  description?: string;
  imageUrl?: string;
  sourceUrl?: string;
  options?: string;
  optionName?: string[];
  optionDescription?: string[];
  general?: string;
}

export function CreateTopicForm({ categories }: CreateTopicFormProps) {
  const { user } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [options, setOptions] = useState<OptionField[]>([
    { name: "", description: "" },
    { name: "", description: "" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const validate = useCallback((): FormErrors => {
    const errs: FormErrors = {};

    if (title.length < 5) {
      errs.title = "Title must be at least 5 characters";
    } else if (title.length > 100) {
      errs.title = "Title must be at most 100 characters";
    }

    if (!categoryId) {
      errs.categoryId = "Please select a category";
    }

    if (description.length > 2000) {
      errs.description = "Description must be at most 2000 characters";
    }

    if (imageUrl && !isValidUrl(imageUrl)) {
      errs.imageUrl = "Please enter a valid image URL";
    }

    if (sourceUrl && !isValidUrl(sourceUrl)) {
      errs.sourceUrl = "Please enter a valid source URL";
    }

    const validOptions = options.filter((o) => o.name.trim().length > 0);
    if (validOptions.length < 2) {
      errs.options = "At least 2 options are required";
    }

    const optionNameErrors: string[] = [];
    const optionDescErrors: string[] = [];
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      if (opt.name.length > 200) {
        optionNameErrors[i] = "Option name must be at most 200 characters";
      }
      if (opt.description.length > 1000) {
        optionDescErrors[i] = "Description must be at most 1000 characters";
      }
    }
    if (optionNameErrors.length > 0) {
      errs.optionName = optionNameErrors;
    }
    if (optionDescErrors.length > 0) {
      errs.optionDescription = optionDescErrors;
    }

    return errs;
  }, [title, categoryId, description, imageUrl, sourceUrl, options]);

  const handleAddOption = useCallback(() => {
    if (options.length >= 20) return;
    setOptions((prev) => [...prev, { name: "", description: "" }]);
  }, [options.length]);

  const handleRemoveOption = useCallback((index: number) => {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }, [options.length]);

  const handleOptionChange = useCallback(
    (index: number, field: keyof OptionField, value: string) => {
      setOptions((prev) =>
        prev.map((opt, i) => (i === index ? { ...opt, [field]: value } : opt))
      );
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    if (!user) return;

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    const payload = {
      title: title.trim(),
      categoryId: Number(categoryId),
      description: description.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
      sourceUrl: sourceUrl.trim() || undefined,
      options: options
        .filter((o) => o.name.trim().length > 0)
        .map((o) => ({
          name: o.name.trim(),
          description: o.description.trim() || undefined,
        })),
    };

    try {
      const res = await fetch("/api/trpc/topics.create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ json: payload }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const errMsg = data?.error?.json?.message ?? data?.error?.message ?? "Failed to create topic";
        setErrors({ general: errMsg });
        setIsSubmitting(false);
        return;
      }

      const result = data?.result?.data?.json;
      if (result?.slug) {
        router.push(`/topic/${result.slug}`);
      } else {
        router.push("/");
      }
    } catch (e) {
      setErrors({ general: "Network error. Please try again." });
      setIsSubmitting(false);
    }
  }, [user, validate, title, categoryId, description, imageUrl, sourceUrl, options, router]);

  if (!user) {
    return (
      <div className="rounded-lg border border-input/50 bg-muted/30 px-6 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          Please log in to create a topic.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="space-y-6"
    >
      {/* Title */}
      <div className="space-y-2">
        <label htmlFor="title" className="text-sm font-medium text-foreground">
          Title <span className="text-red-400">*</span>
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Rate the best laptop for coding"
          maxLength={100}
          disabled={isSubmitting}
          className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm text-foreground placeholder-subtle focus:outline-none focus:border-subtle transition-colors disabled:opacity-50"
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-subtle">
            {title.length}/100 characters
          </span>
          {errors.title && (
            <span className="text-[11px] text-red-400">{errors.title}</span>
          )}
        </div>
      </div>

      {/* Category */}
      <div className="space-y-2">
        <label htmlFor="category" className="text-sm font-medium text-foreground">
          Category <span className="text-red-400">*</span>
        </label>
        <select
          id="category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          disabled={isSubmitting}
          className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:border-subtle transition-colors disabled:opacity-50"
        >
          <option value="">Select a category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        {errors.categoryId && (
          <span className="text-[11px] text-red-400">{errors.categoryId}</span>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <label htmlFor="description" className="text-sm font-medium text-foreground">
          Description <span className="text-subtle/60 text-[11px] font-normal">(optional)</span>
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Provide context for your topic..."
          maxLength={2000}
          rows={3}
          disabled={isSubmitting}
          className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm text-foreground placeholder-subtle resize-none focus:outline-none focus:border-subtle transition-colors disabled:opacity-50"
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-subtle">
            {description.length}/2000 characters
          </span>
          {errors.description && (
            <span className="text-[11px] text-red-400">{errors.description}</span>
          )}
        </div>
      </div>

      {/* Optional URLs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="imageUrl" className="text-sm font-medium text-foreground">
            Image URL <span className="text-subtle/60 text-[11px] font-normal">(optional)</span>
          </label>
          <input
            id="imageUrl"
            type="text"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            disabled={isSubmitting}
            className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm text-foreground placeholder-subtle focus:outline-none focus:border-subtle transition-colors disabled:opacity-50"
          />
          {errors.imageUrl && (
            <span className="text-[11px] text-red-400">{errors.imageUrl}</span>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="sourceUrl" className="text-sm font-medium text-foreground">
            Source URL <span className="text-subtle/60 text-[11px] font-normal">(optional)</span>
          </label>
          <input
            id="sourceUrl"
            type="text"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://example.com/article"
            disabled={isSubmitting}
            className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm text-foreground placeholder-subtle focus:outline-none focus:border-subtle transition-colors disabled:opacity-50"
          />
          {errors.sourceUrl && (
            <span className="text-[11px] text-red-400">{errors.sourceUrl}</span>
          )}
        </div>
      </div>

      {/* Options */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            Options to Rate <span className="text-red-400">*</span>
          </label>
          <span className="text-[11px] text-subtle">
            {options.filter((o) => o.name.trim()).length} set / {options.length} total
          </span>
        </div>

        {errors.options && (
          <span className="text-[11px] text-red-400 block">{errors.options}</span>
        )}

        <div className="space-y-2">
          {options.map((option, index) => (
            <div
              key={index}
              className="rounded-lg border border-border/60 bg-card/50 p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-subtle w-6">
                  {index + 1}
                </span>
                <input
                  type="text"
                  value={option.name}
                  onChange={(e) =>
                    handleOptionChange(index, "name", e.target.value)
                  }
                  placeholder={`Option ${index + 1} name`}
                  maxLength={200}
                  disabled={isSubmitting}
                  className="flex-1 rounded border border-input bg-muted/50 px-2.5 py-1.5 text-sm text-foreground placeholder-subtle focus:outline-none focus:border-subtle transition-colors disabled:opacity-50"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(index)}
                    disabled={isSubmitting}
                    className="shrink-0 text-[11px] text-subtle hover:text-red-400 transition-colors disabled:opacity-50"
                    aria-label="Remove option"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="pl-6">
                <input
                  type="text"
                  value={option.description}
                  onChange={(e) =>
                    handleOptionChange(index, "description", e.target.value)
                  }
                  placeholder="Brief description (optional)"
                  maxLength={1000}
                  disabled={isSubmitting}
                  className="w-full rounded border border-input bg-muted/50 px-2.5 py-1.5 text-xs text-foreground placeholder-subtle focus:outline-none focus:border-subtle transition-colors disabled:opacity-50"
                />
              </div>
              {errors.optionName?.[index] && (
                <span className="text-[11px] text-red-400 pl-6">
                  {errors.optionName[index]}
                </span>
              )}
              {errors.optionDescription?.[index] && (
                <span className="text-[11px] text-red-400 pl-6">
                  {errors.optionDescription[index]}
                </span>
              )}
            </div>
          ))}
        </div>

        {options.length < 20 && (
          <button
            type="button"
            onClick={handleAddOption}
            disabled={isSubmitting}
            className="w-full rounded-lg border border-dashed border-border/60 bg-muted/30 px-3 py-2 text-sm text-subtle hover:text-foreground hover:border-subtle transition-all disabled:opacity-50"
          >
            + Add Option
          </button>
        )}
      </div>

      {/* General error */}
      {errors.general && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
          {errors.general}
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-[11px] text-subtle">
          <span className="text-red-400">*</span> Required fields
        </span>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Creating..." : "Create Topic"}
        </button>
      </div>
    </form>
  );
}

function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}
