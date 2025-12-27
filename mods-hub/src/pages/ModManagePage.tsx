/**
 * Mod management page
 * Allows authors to manage their mods (update, delete, add versions)
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useModDetail, useUpdateMod, useDeleteMod, useUploadVersion } from '../hooks/useMods';
import { ModManageForm } from '../components/mod/ModManageForm';
import { VersionUploadForm } from '../components/mod/VersionUploadForm';
import { useAuthStore } from '../stores/auth';
import styled from 'styled-components';
import { colors, spacing } from '../theme';

const PageContainer = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: ${spacing.xl};
`;

const Title = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  color: ${colors.text};
`;

const Unauthorized = styled.div`
  text-align: center;
  padding: ${spacing.xxl};
  color: ${colors.danger};
`;

const Loading = styled.div`
  text-align: center;
  padding: ${spacing.xxl};
  color: ${colors.textSecondary};
`;

export function ModManagePage() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuthStore();
    const { data, isLoading } = useModDetail(slug || '');
    const updateMod = useUpdateMod();
    const deleteMod = useDeleteMod();
    const uploadVersion = useUploadVersion();

    if (isLoading) return <Loading>Loading...</Loading>;
    if (!data) return <Unauthorized>Mod not found</Unauthorized>;
    if (!isAuthenticated || data.mod.authorId !== user?.userId) {
        return <Unauthorized>You don't have permission to manage this mod</Unauthorized>;
    }

    const handleUpdate = async (updates: any) => {
        try {
            await updateMod.mutateAsync({ slug: slug!, updates });
        } catch (error) {
            // Error handled by mutation
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this mod? This action cannot be undone.')) {
            return;
        }
        try {
            await deleteMod.mutateAsync(slug!);
            navigate('/');
        } catch (error) {
            // Error handled by mutation
        }
    };

    const handleVersionUpload = async (uploadData: { file: File; metadata: any }) => {
        if (!data) return;
        try {
            await uploadVersion.mutateAsync({
                modId: data.mod.modId, // Still use modId for version upload API
                file: uploadData.file,
                metadata: uploadData.metadata,
            });
        } catch (error) {
            // Error handled by mutation
        }
    };

    return (
        <PageContainer>
            <Title>Manage Mod: {data.mod.title}</Title>
            <ModManageForm
                mod={data.mod}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                isLoading={updateMod.isPending || deleteMod.isPending}
            />
            <VersionUploadForm
                modId={data.mod.modId} // Still use modId for version upload
                onSubmit={handleVersionUpload}
                isLoading={uploadVersion.isPending}
            />
        </PageContainer>
    );
}

