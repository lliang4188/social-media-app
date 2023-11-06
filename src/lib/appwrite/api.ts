import { ID, Query } from 'appwrite'
 
import { INewPost, INewUser, IUpdatePost } from "@/types";
import { account, appwriteConfig, avatars, database, storage } from './config'
import { async } from './api';

export async function createUserAccount(user: INewUser) {
   try {
    const newAccount = await account.create(
      ID.unique(),
      user.email,
      user.password,
      user.name
    ) 
      
    if (!newAccount) throw Error
    
    const avatarUrl = avatars.getInitials(user.name)

    const newUser = await saveUserToDB({
      accountId: newAccount.$id,
      name: newAccount.name,
      email: newAccount.email,
      username: user.username,
      imageUrl: avatarUrl
    })

    return newUser
   } catch (error) {
    console.log(error)
    return error
   }
}

export async function saveUserToDB(user: {
  accountId: string;
  email: string;
  name: string;
  imageUrl: URL;
  username?: string;
}) {
  try {
    const newUser = await database.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      ID.unique(),
      user,
    )

    return newUser
  } catch (error) {
   console.log(error) 
  }
}

export async function signInAccount(user: { email: string; password: string; }) {
  try {
    const session = await account.createEmailSession(user.email, user.password)

    return session 
  } catch (error) {
    console.log(error)
  }
}

export async function getCurrentUser() {
  try {
    const currentAccount = await account.get()

    if (!currentAccount) throw Error

    const currentUser = await database.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      [Query.equal('accountId', currentAccount.$id)]
    )

    if(!currentUser) throw Error 

    return currentUser.documents[0] 
  } catch (error) {
    console.log(error)
  }
}

export async function signOutAccount() {
  try {
    const session = await account.deleteSession('current')
    
    return session
  } catch (error) {
    console.log(error)    
  }
}

export async function craetePost(post: INewPost) {
  try {
    // upload image to storage
    const uploadedFile = await uploadFile(post.file[0])

    if (!uploadedFile) throw Error

    // Get file url
    const fileUrl = getFilePreview(uploadedFile.$id)

    
    if (!fileUrl) {
      deleteFile(uploadedFile.$id)
      throw Error
    }

    // Convert tags in an array
    const tags = post.tags?.replace(/ /g, '').split(',') || []

    // Save post to database

    const newPost = await database.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.postCollectionId,
      ID.unique(),
      {
        creator: post.userId,
        caption: post.caption,
        imageUrl: fileUrl,
        imageId: uploadedFile.$id,
        location: post.location,
        tags: tags
      }
    )
    
    if (!newPost) {
      await deleteFile(uploadedFile.$id)
      throw Error
    }

    return newPost

  } catch (error) {
    console.log(error)
  }
}

export async function uploadFile(file: File) {
  try {
    const uploadedFile = await storage.createFile(
      appwriteConfig.storageId,
      ID.unique(),
      file
    )
    
    return uploadedFile
  } catch (error) {
    console.log(error)
  }
}

export function getFilePreview(fileId: string) {
  try {
    const fileUrl = storage.getFilePreview(
      appwriteConfig.storageId,
      fileId,
      2000,
      2000,
      'top',
      100
    )

    return fileUrl
  } catch (error) {
    console.log(error)
  }
}

export async function deleteFile(fileId: string) {

  try {
    await storage.deleteFile(
      appwriteConfig.storageId,
      fileId
    )

    return { status: 'ok' }

  } catch (error) {
    console.log(error)
  }
}

export async function getRecentPosts() {
  const posts = await database.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.postCollectionId,
    [Query.orderDesc('$createdAt'), Query.limit(20)]
  )

  if (!posts) throw Error
  
  return posts
  
}


export async function likePost(postId: string, likesArray: string[]) {
  try {
    const updatedPost = await database.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.postCollectionId,
      postId,
      {
        likes: likesArray
      }
    )

    if(!updatedPost) throw Error

    return updatedPost
    
  } catch (error) {
    console.log(error)
  }
}

export async function savePost(postId: string, userId: string) {
  try {
    const updatedPost = await database.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.saveCollectionId,
      ID.unique(),
      {
        user: userId,
        post: postId
      }
    )

    if(!updatedPost) throw Error

    return updatedPost
    
  } catch (error) {
    console.log(error)
  }
}

export async function deleteSavePost(savedRecordId: string) {
  try {
    const statusCode = await database.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.saveCollectionId,
      savedRecordId
    )

    if(!statusCode) throw Error

    return { status: 'ok'}
    
  } catch (error) {
    console.log(error)
  }
}

export async function getPostById(postId: string) {
  try {
    const post = await database.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.postCollectionId,
      postId
    )

    return post
  } catch (error) {
    console.log(error)
  }
}

export async function updatePost(post: IUpdatePost) {
  const hasFileToUpdate =  post.file.length > 0
  try {

    let image = {
      imageUrl: post.imageUrl,
      imageId: post.imageId,

    }

    if (hasFileToUpdate) {
      // upload image to storage
      const uploadedFile = await uploadFile(post.file[0])
  
      if (!uploadedFile) throw Error
      // Get file url
      const fileUrl = getFilePreview(uploadedFile.$id)
  
      
      if (!fileUrl) {
        deleteFile(uploadedFile.$id)
        throw Error
      }

      image = { ...image, imageUrl: fileUrl, imageId: uploadedFile.$id }

    }


    // Convert tags in an array
    const tags = post.tags?.replace(/ /g, '').split(',') || []

    // Save post to database

    const updatePost = await database.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.postCollectionId,
      post.postId,
      {
        caption: post.caption,
        imageUrl: image.imageUrl,
        imageId: image.imageId,
        location: post.location,
        tags: tags
      }
    )
    
    if (!updatePost) {
      await deleteFile(post.imageId)
      throw Error
    }

    return updatePost

  } catch (error) {
    console.log(error)
  }
}

export async function deletePost(postId: string, imageId: string) {
  if (!postId || !imageId) throw Error
  
  try {
    await database.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.postCollectionId,
      postId
    )

    return { status: 'ok'}
    
  } catch (error) {
    console.log(error)
  }
}