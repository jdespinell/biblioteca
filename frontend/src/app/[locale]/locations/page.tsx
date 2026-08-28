"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { useTranslations } from "next-intl";
import { MapPin, Plus, Edit2, Trash2, BookOpen, X, Loader2 } from "lucide-react";
import { locationsApi, type Location } from "@/lib/api/locations";

interface LocationModalProps {
  location?: Location;
  onSave: (data: { name: string; description?: string }) => Promise<void>;
  onClose: () => void;
}

function LocationModal({ location, onSave, onClose }: LocationModalProps) {
  const t = useTranslations("locations");
  const tc = useTranslations("common");
  const [name, setName] = useState(location?.name ?? "");
  const [description, setDescription] = useState(location?.description ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      await onSave({ name: name.trim(), description: description.trim() || undefined });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-gray-900 text-lg">
            {location ? t("editLocation") : t("addLocation")}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("name")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              autoFocus
              required
            />
            <p className="text-xs text-gray-400 mt-1">{t("examples")}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("description")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              {tc("cancel")}
            </button>
            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              className="flex-1 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors text-sm flex items-center justify-center gap-2"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {tc("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LocationsPage() {
  const t = useTranslations("locations");
  const tc = useTranslations("common");
  const [showModal, setShowModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | undefined>();

  const { data: locations, isLoading } = useSWR<Location[]>(
    "locations",
    locationsApi.list
  );

  const handleCreate = async (data: { name: string; description?: string }) => {
    const created = await locationsApi.create(data);
    mutate("locations", [...(locations ?? []), created], false);
  };

  const handleUpdate = async (data: { name: string; description?: string }) => {
    if (!editingLocation) return;
    const updated = await locationsApi.update(editingLocation.id, data);
    mutate(
      "locations",
      locations?.map((l) => (l.id === editingLocation.id ? updated : l)),
      false
    );
    setEditingLocation(undefined);
  };

  const handleDelete = async (location: Location) => {
    if (!confirm(t("deleteConfirm"))) return;
    await locationsApi.delete(location.id);
    mutate("locations", locations?.filter((l) => l.id !== location.id), false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{t("subtitle")}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors text-sm"
        >
          <Plus className="h-4 w-4" />
          {t("addLocation")}
        </button>
      </div>

      {/* Locations list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl h-20 animate-pulse border border-gray-100" />
          ))}
        </div>
      ) : locations?.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <MapPin className="h-12 w-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">{t("noLocations")}</p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
          >
            <Plus className="h-4 w-4" />
            {t("addLocation")}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {locations?.map((location) => (
            <div
              key={location.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4"
            >
              <div className="p-2.5 bg-primary-50 rounded-lg flex-shrink-0">
                <MapPin className="h-5 w-5 text-primary-600" />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900">{location.name}</h3>
                {location.description && (
                  <p className="text-sm text-gray-500 truncate">{location.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                  <BookOpen className="h-3 w-3" />
                  {t("books", { count: location.book_count })}
                </p>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => { setEditingLocation(location); setShowModal(true); }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(location)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <LocationModal
          location={editingLocation}
          onSave={editingLocation ? handleUpdate : handleCreate}
          onClose={() => { setShowModal(false); setEditingLocation(undefined); }}
        />
      )}
    </div>
  );
}
