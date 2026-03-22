import { useState } from 'react';
import { Plus, Search, UserPlus, RotateCcw } from 'lucide-react';
import type { User, UserCreate, UserUpdate } from '../../api/types';
import { useUsersList, useCreateUser, useUpdateUser, useDeleteUser, useReactivateUser } from '../../hooks/use-users';
import { getUserRoleOption } from '../../lib/constants';
import { UserForm } from './user-form';

export function UsersPanel() {
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data, isLoading } = useUsersList(
    showInactive ? {} : { is_active: true },
  );
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const reactivateUser = useReactivateUser();

  const users = data?.users ?? [];

  // Client-side filtering for search and role
  const filtered = users.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        u.first_name.toLowerCase().includes(q) ||
        u.last_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.employee_id?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  const handleCreate = (formData: UserCreate | UserUpdate) => {
    createUser.mutate(formData as UserCreate, {
      onSuccess: () => {
        setShowForm(false);
      },
    });
  };

  const handleUpdate = (formData: UserCreate | UserUpdate) => {
    if (!editingUser) return;
    updateUser.mutate(
      { id: editingUser.user_id, data: formData as UserUpdate },
      {
        onSuccess: () => {
          setEditingUser(null);
        },
      },
    );
  };

  const handleDelete = (userId: string) => {
    deleteUser.mutate(userId, {
      onSuccess: () => {
        setDeleteConfirmId(null);
      },
    });
  };

  const handleReactivate = (userId: string) => {
    reactivateUser.mutate(userId);
  };

  const activeCount = users.filter((u) => u.is_active).length;
  const inactiveCount = users.filter((u) => !u.is_active).length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Users & Roles</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {activeCount} active user{activeCount !== 1 ? 's' : ''}
              {inactiveCount > 0 && ` / ${inactiveCount} inactive`}
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
          >
            <UserPlus size={14} />
            Add User
          </button>
        </div>

        {/* Filters row */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs rounded border border-gray-300 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="supervisor">Supervisor</option>
            <option value="crew_chief">Crew Chief</option>
          </select>
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Show inactive
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-xs text-gray-400">
            Loading users...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <p className="text-sm font-medium">No users found</p>
            <p className="text-xs mt-1">
              {users.length === 0
                ? 'Add your first team member to get started'
                : 'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Employee ID</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Email</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Phone</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Role</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Status</th>
                <th className="text-right px-4 py-2 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((user) => {
                const roleOpt = getUserRoleOption(user.role);
                return (
                  <tr
                    key={user.user_id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setEditingUser(user)}
                  >
                    <td className="px-4 py-2.5">
                      <span className={`font-medium ${user.is_active ? 'text-gray-900' : 'text-gray-400'}`}>
                        {user.first_name} {user.last_name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">
                      {user.employee_id ?? '--'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{user.email}</td>
                    <td className="px-4 py-2.5 text-gray-500">{user.phone ?? '--'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${roleOpt.color}`}>
                        {roleOpt.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {user.is_active ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          <span className="text-green-700">Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                          <span className="text-gray-400">Inactive</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {user.is_active ? (
                          deleteConfirmId === user.user_id ? (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-gray-500">Deactivate?</span>
                              <button
                                onClick={() => handleDelete(user.user_id)}
                                className="px-1.5 py-0.5 text-[10px] font-medium text-red-700 bg-red-50 rounded hover:bg-red-100"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-1.5 py-0.5 text-[10px] font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(user.user_id)}
                              className="px-2 py-0.5 text-[10px] font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                            >
                              Deactivate
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => handleReactivate(user.user_id)}
                            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <RotateCcw size={10} />
                            Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create form modal */}
      {showForm && (
        <UserForm
          mode="create"
          onSubmit={handleCreate}
          onCancel={() => {
            setShowForm(false);
            createUser.reset();
          }}
          isSubmitting={createUser.isPending}
          error={createUser.error?.message ?? null}
        />
      )}

      {/* Edit form modal */}
      {editingUser && (
        <UserForm
          mode="edit"
          user={editingUser}
          onSubmit={handleUpdate}
          onCancel={() => {
            setEditingUser(null);
            updateUser.reset();
          }}
          isSubmitting={updateUser.isPending}
          error={updateUser.error?.message ?? null}
        />
      )}
    </div>
  );
}
