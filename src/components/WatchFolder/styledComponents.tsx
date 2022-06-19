import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import VerticallyCentered from 'components/Container';

export const MappingsContainer = styled(Box)(({ theme }) => ({
    height: '278px',
    overflow: 'auto',
    '&::-webkit-scrollbar': {
        width: '4px',
    },
    '&::-webkit-scrollbar-thumb': {
        backgroundColor: theme.palette.secondary.main,
    },
}));

export const NoMappingsContainer = styled(VerticallyCentered)({
    height: '278px',
    textAlign: 'left',
    alignItems: 'flex-start',
});

export const HorizontalFlex = styled(Box)({
    display: 'flex',
});

export const EntryContainer = styled(Box)({
    marginLeft: '12px',
    marginRight: '6px',
    marginBottom: '12px',
});
