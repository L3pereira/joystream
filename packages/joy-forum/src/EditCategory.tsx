import React from 'react';
import { Button, Message } from 'semantic-ui-react';
import { Form, Field, withFormik, FormikProps } from 'formik';
import * as Yup from 'yup';
import { History } from 'history';

import TxButton from '@polkadot/joy-utils/TxButton';
import { SubmittableResult } from '@polkadot/api';
import { /* withCalls, */ withMulti } from '@polkadot/ui-api/with';

import * as JoyForms from '@polkadot/joy-utils/forms';
import { AccountId, Text, Bool } from '@polkadot/types';
import { Option, Vector } from '@polkadot/types/codec';
import { CategoryId, Category } from './types';
import Section from '@polkadot/joy-utils/Section';
import { useMyAccount } from '@polkadot/joy-utils/MyAccountContext';
import { useForum } from './Context';
import { UrlHasIdProps, CategoryCrumbs } from './utils';
import { withOnlyForumSudo } from './ForumSudo';
import { withForumCalls } from './calls';

const buildSchema = (p: ValidationProps) => Yup.object().shape({
  name: Yup.string()
    // .min(p.minNameLen, `Category name is too short. Minimum length is ${p.minNameLen} chars.`)
    // .max(p.maxNameLen, `Category name is too long. Maximum length is ${p.maxNameLen} chars.`)
    .required('Category name is required'),
  text: Yup.string()
    // .min(p.minTextLen, `Category description is too short. Minimum length is ${p.minTextLen} chars.`)
    // .max(p.maxTextLen, `Category description is too long. Maximum length is ${p.maxTextLen} chars.`)
});

type ValidationProps = {
  // minNameLen: number,
  // maxNameLen: number,
  // minTextLen: number,
  // maxTextLen: number
};

type OuterProps = ValidationProps & {
  history?: History,
  id?: CategoryId,
  parentId?: CategoryId,
  struct?: Category
};

type FormValues = {
  name: string,
  text: string
};

type FormProps = OuterProps & FormikProps<FormValues>;

const LabelledField = JoyForms.LabelledField<FormValues>();

const LabelledText = JoyForms.LabelledText<FormValues>();

const InnerForm = (props: FormProps) => {
  const {
    history,
    id,
    parentId,
    struct,
    values,
    dirty,
    isValid,
    isSubmitting,
    setSubmitting,
    resetForm
  } = props;

  const {
    name,
    text
  } = values;

  const { state: { address } } = useMyAccount();
  const { dispatch } = useForum();

  const onSubmit = (sendTx: () => void) => {
    if (isValid) sendTx();
  };

  const onTxCancelled = () => {
    setSubmitting(false);
  };

  const onTxFailed = (_txResult: SubmittableResult) => {
    setSubmitting(false);
  };

  const onTxSuccess = (_txResult: SubmittableResult) => {
    setSubmitting(false);
  };

  const isNew = struct === undefined;
  const isSubcategory = parentId !== undefined;

  const buildTxParams = () => {
    if (!isValid) return [];

    if (isNew) {
      return [ id /* TODO add all required params */ ];
    } else {
      return [ /* TODO add all required params */ ];
    }
  };

  const goToView = (id: CategoryId | number) => {
    if (history) {
      history.push('/forum/categories/' + id.toString());
    }
  };

  const updateForumContext = () => {
    const category = new Category({
      owner: new AccountId(address),
      parent_id: new Option(CategoryId, parentId),
      children_ids: new Vector(CategoryId, []),
      deleted: new Bool(false),
      archived: new Bool(false),
      name: new Text(name),
      text: new Text(text)
    });
    if (id) {
      dispatch({ type: 'UpdateCategory', category, id: id.toNumber() });
      goToView(id);
    } else {
      dispatch({ type: 'NewCategory', category, onCreated: goToView });
    }
  };

  const categoryWord = isSubcategory ? `subcategory` : `category`;

  const form =
    <Form className='ui form JoyForm EditEntityForm'>

      <LabelledText name='name' placeholder={`Name your ${categoryWord}`} {...props} />

      <LabelledField name='text' {...props}>
        <Field component='textarea' id='text' name='text' disabled={isSubmitting} rows={3} placeholder={`Describe your ${categoryWord}. You can use Markdown.`} />
      </LabelledField>

      <LabelledField {...props}>

        { /* TODO delete this button once integrated w/ substrate */ }
        <Button
          type='button'
          size='large'
          primary
          disabled={!dirty || isSubmitting}
          onClick={updateForumContext}
          content={isNew
            ? `Create a ${categoryWord}`
            : `Update a category`
          }
        />

        <TxButton
          style={{ display: 'none' }} // TODO delete once integrated w/ substrate
          type='submit'
          size='large'
          label={isNew
            ? `Create a ${categoryWord}`
            : `Update a category`
          }
          isDisabled={!dirty || isSubmitting}
          params={buildTxParams()}
          tx={isNew
            ? 'forum.newCategory'
            : 'forum.updateCategory'
          }
          onClick={onSubmit}
          txCancelledCb={onTxCancelled}
          txFailedCb={onTxFailed}
          txSuccessCb={onTxSuccess}
        />
        <Button
          type='button'
          size='large'
          disabled={!dirty || isSubmitting}
          onClick={() => resetForm()}
          content='Reset form'
        />
      </LabelledField>
    </Form>;

  const sectionTitle = isNew
    ? `New ${categoryWord}`
    : `Edit my ${categoryWord}`;

  return <>
    <CategoryCrumbs categoryId={parentId} />
    <Section className='EditEntityBox' title={sectionTitle}>
      {form}
    </Section>
  </>;
};

const EditForm = withFormik<OuterProps, FormValues>({

  // Transform outer props into form values
  mapPropsToValues: props => {
    const { parentId, struct } = props;

    return {
      parentId: struct ? struct.parent_id : parentId,
      name: struct ? struct.name : '',
      text: struct ? struct.text : ''
    };
  },

  validationSchema: buildSchema,

  handleSubmit: values => {
    // do submitting things
  }
})(InnerForm);

function FormOrLoading (props: OuterProps) {
  const { state: { address } } = useMyAccount();
  const { struct } = props;

  if (!address || !struct) {
    return <em>Loading category...</em>;
  }

  if (struct.isEmpty) {
    return <em>Category not found</em>;
  }

  const isMyStruct = address === struct.owner.toString();
  if (isMyStruct) {
    return <EditForm {...props} />;
  }

  return <Message error className='JoyMainStatus' header='You are not allowed edit this category.' />;
}

function withIdFromUrl (Component: React.ComponentType<OuterProps>) {
  return function (props: UrlHasIdProps) {
    const { match: { params: { id } } } = props;
    try {
      return <Component id={new CategoryId(id)} />;
    } catch (err) {
      return <em>Invalid category ID: {id}</em>;
    }
  };
}

function NewSubcategoryForm (props: UrlHasIdProps) {
  const { match: { params: { id } } } = props;
  try {
    return <EditForm parentId={new CategoryId(id)} />;
  } catch (err) {
    return <em>Invalid parent category id: {id}</em>;
  }
}

export const NewCategory = withMulti(
  EditForm,
  withOnlyForumSudo
);

export const NewSubcategory = withMulti(
  NewSubcategoryForm,
  withOnlyForumSudo
);

export const EditCategory = withMulti(
  FormOrLoading,
  withOnlyForumSudo,
  withIdFromUrl,
  withForumCalls<OuterProps>(
    ['categoryById', { paramName: 'id', propName: 'struct' }]
  )
);
